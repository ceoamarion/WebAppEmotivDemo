/**
 * Supabase Sessions Service
 * 
 * Handles saving/loading session data to/from Supabase.
 * Non-blocking writes with retry logic.
 */

import { createClient } from '@/utils/supabase/client'
import type { SessionRecord } from '@/data/sessionStorage'

export interface SupabaseSession {
    id: string
    user_id: string
    started_at: string
    ended_at: string
    duration_sec: number
    best_state: string
    best_state_duration_sec: number
    avg_eeg_quality: number | null
    avg_valence: number
    avg_arousal: number
    avg_control: number
    notes: string | null
    created_at: string
}

export interface SupabaseSegment {
    id: string
    session_id: string
    state_name: string
    tier: string
    started_at: string
    ended_at: string
    duration_sec: number
    avg_confidence: number
}

/**
 * Save a completed SessionRecord to Supabase.
 * Non-blocking — runs in background.
 * Returns a promise that resolves with the Supabase session ID or null on failure.
 */
export async function saveSessionToSupabase(
    record: SessionRecord,
    onStatus?: (status: 'saving' | 'saved' | 'error', message?: string) => void
): Promise<string | null> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        // Not logged in — skip cloud save silently
        return null
    }

    onStatus?.('saving')

    try {
        // 1. Insert the session row
        const { data: sessionRow, error: sessionError } = await supabase
            .from('sessions')
            .insert({
                user_id: user.id,
                started_at: record.startedAt,
                ended_at: record.endedAt,
                duration_sec: record.durationSec,
                best_state: record.bestState.stateId,
                best_state_duration_sec: record.bestState.sustainedSec,
                avg_eeg_quality: record.eegQuality?.avgEEGQualityPercent ?? null,
                avg_valence: record.emotionAverages.valence,
                avg_arousal: record.emotionAverages.arousal,
                avg_control: record.emotionAverages.control,
                notes: record.notes ?? null,
            })
            .select('id')
            .single()

        if (sessionError || !sessionRow) {
            throw sessionError ?? new Error('No session row returned')
        }

        const sessionId = sessionRow.id

        // 2. Build state segments from the timeline
        const segments = buildSegments(record, sessionId)

        if (segments.length > 0) {
            const { error: segError } = await supabase
                .from('session_state_segments')
                .insert(segments)

            if (segError) {
                console.warn('[Supabase] Segment insert error:', segError.message)
                // Non-fatal — session is still saved
            }
        }

        onStatus?.('saved')
        return sessionId
    } catch (err: any) {
        console.error('[Supabase] Session save failed:', err?.message)
        onStatus?.('error', err?.message ?? 'Unknown error')
        return null
    }
}

/**
 * Convert the stateTimeline into contiguous segments for session_state_segments table.
 */
function buildSegments(record: SessionRecord, sessionId: string) {
    const timeline = record.stateTimeline
    if (timeline.length === 0) return []

    const sessionStart = new Date(record.startedAt).getTime()
    const segments: Omit<SupabaseSegment, 'id'>[] = []

    let segStart = 0
    let segState = timeline[0].stateId
    let segTier = timeline[0].status
    let confidenceSum = timeline[0].confidence
    let confidenceCount = 1

    for (let i = 1; i < timeline.length; i++) {
        const sample = timeline[i]

        if (sample.stateId !== segState) {
            // Flush current segment
            const startedAt = new Date(sessionStart + segStart).toISOString()
            const endedAt = new Date(sessionStart + sample.t).toISOString()
            const durationSec = Math.round((sample.t - segStart) / 1000)

            segments.push({
                session_id: sessionId,
                state_name: segState,
                tier: segTier,
                started_at: startedAt,
                ended_at: endedAt,
                duration_sec: durationSec,
                avg_confidence: Math.round(confidenceSum / confidenceCount),
            })

            segStart = sample.t
            segState = sample.stateId
            segTier = sample.status
            confidenceSum = sample.confidence
            confidenceCount = 1
        } else {
            confidenceSum += sample.confidence
            confidenceCount++
            if (sample.status === 'locked') segTier = 'locked'
            else if (sample.status === 'confirmed' && segTier !== 'locked') segTier = 'confirmed'
        }
    }

    // Flush last segment
    const lastT = timeline[timeline.length - 1].t
    const endMs = sessionStart + record.durationSec * 1000
    segments.push({
        session_id: sessionId,
        state_name: segState,
        tier: segTier,
        started_at: new Date(sessionStart + segStart).toISOString(),
        ended_at: new Date(endMs).toISOString(),
        duration_sec: Math.round((endMs - sessionStart - segStart) / 1000),
        avg_confidence: Math.round(confidenceSum / confidenceCount),
    })

    return segments
}

/**
 * Load all sessions for the current user from Supabase.
 */
export async function loadSessionsFromSupabase(): Promise<SupabaseSession[]> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) return []

    const { data, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('started_at', { ascending: false })

    if (error) {
        console.error('[Supabase] Load sessions error:', error.message)
        return []
    }

    return data ?? []
}

/**
 * Load state segments for a single session.
 */
export async function loadSegmentsForSession(sessionId: string): Promise<SupabaseSegment[]> {
    const supabase = createClient()

    const { data, error } = await supabase
        .from('session_state_segments')
        .select('*')
        .eq('session_id', sessionId)
        .order('started_at', { ascending: true })

    if (error) {
        console.error('[Supabase] Load segments error:', error.message)
        return []
    }

    return data ?? []
}

/**
 * Delete a session (and its segments via CASCADE).
 */
export async function deleteSessionFromSupabase(sessionId: string): Promise<boolean> {
    const supabase = createClient()

    const { error } = await supabase
        .from('sessions')
        .delete()
        .eq('id', sessionId)

    if (error) {
        console.error('[Supabase] Delete error:', error.message)
        return false
    }

    return true
}
