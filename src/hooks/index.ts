// EEG Hooks - Stable architecture for real-time EEG visualization
export { useEEGStream, type POWData, type EEGStreamData } from './useEEGStream';
export { useInference, type CandidateState } from './useInference';
export {
    useDisplayStabilizer,
    type DisplayModel,
    type DisplayState,
    type TransitionStatus
} from './useDisplayStabilizer';
export {
    useEmotionInference,
    type EmotionResult,
    type EmotionAxes,
    type TopEmotion,
    type EmotionLabel
} from './useEmotionInference';
export {
    useDurationValidation,
    type ValidatedState,
    type ValidationTier,
    type DurationValidationResult
} from './useDurationValidation';
export {
    useUnifiedState,
    type UnifiedState,
    type UnifiedDisplayModel,
    type ChallengerState as UnifiedChallengerState
} from './useUnifiedState';
