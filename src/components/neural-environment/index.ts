/**
 * Neural Environment - Cinematic Edition
 * 
 * Premium AAA sci-fi meditation visualization system
 * 
 * Usage:
 * import NeuralEnvironment from '@/components/neural-environment';
 * 
 * <NeuralEnvironment
 *   currentStateId={stateMachine.currentState.id}
 *   currentConfidence={stateMachine.currentState.confidence}
 *   transitionStatus={stateMachine.status}
 *   bandPowers={normalizedBandPowers}
 *   emotionAxes={stateMachine.emotionAxes}
 *   isEmotionallyStable={stateMachine.isEmotionallyStable}
 * />
 */

export { default } from './NeuralEnvironment';
export { default as NeuralEnvironment } from './NeuralEnvironment';
export { default as OrbCanvas } from './OrbCanvas';
export { default as FieldCanvas } from './FieldCanvas';
export { default as CinematicControls } from './CinematicControls';
export * from './types';
export * from './useCinematicVisuals';
