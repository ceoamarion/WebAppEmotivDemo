# Neural Environment Integration Guide

## Quick Start

Add the NeuralEnvironment to your Experience component:

```tsx
import NeuralEnvironment from '@/components/neural-environment';

// Inside your Experience component, after getting stateMachine and latestPOW:

// Prepare band powers (normalize to 0-1)
const bandPowers = useMemo(() => {
  if (!latestPOW) {
    return { theta: 0.5, alpha: 0.5, betaL: 0.3, betaH: 0.2, gamma: 0.1 };
  }
  // latestPOW values are typically 0-100 or similar, normalize:
  const total = latestPOW.theta + latestPOW.alpha + latestPOW.betaL + latestPOW.betaH + latestPOW.gamma || 1;
  return {
    theta: latestPOW.theta / total,
    alpha: latestPOW.alpha / total,
    betaL: latestPOW.betaL / total,
    betaH: latestPOW.betaH / total,
    gamma: latestPOW.gamma / total,
  };
}, [latestPOW]);

// In your JSX, replace the existing canvas/orb area:
<div className={styles.orbArea}>
  {/* Left and Right cards remain unchanged */}
  <div className={styles.leftCard}>
    <SMCurrentStateCard state={stateMachine.currentState} />
  </div>

  {/* Replace center with NeuralEnvironment */}
  <div className={styles.centerArea}>
    <NeuralEnvironment
      currentStateId={stateMachine.currentState.id}
      currentConfidence={stateMachine.currentState.confidence}
      challengerStateId={stateMachine.challenger?.id}
      challengerConfidence={stateMachine.challenger?.confidence}
      transitionStatus={stateMachine.status}
      bandPowers={bandPowers}
      emotionAxes={stateMachine.emotionAxes}
      isEmotionallyStable={stateMachine.isEmotionallyStable}
      showIntensitySlider={true}
    />
    {/* Dominant bands overlay */}
    <div className={styles.dominantBands}>
      {stateMachine.currentState.dominantBands.map((band) => (
        <span key={band} className={styles.bandTag}>{band}</span>
      ))}
    </div>
  </div>

  <div className={styles.rightCard}>
    <SMChallengerCard challenger={stateMachine.challenger} />
  </div>
</div>
```

## Full File Replacement (StateMachineOrbArea)

If you want to completely replace the existing orb area, update `StateMachineOrbArea`:

```tsx
function StateMachineOrbArea({ model, bandPowers }: { 
  model: StateMachineOutput; 
  bandPowers: { theta: number; alpha: number; betaL: number; betaH: number; gamma: number };
}) {
  const { currentState, challenger, transitionLabel } = model;

  return (
    <div className={styles.orbArea}>
      {/* LEFT: Current State - SINGLE SOURCE OF TRUTH */}
      <div className={styles.leftCard}>
        <SMCurrentStateCard state={currentState} />
      </div>

      {/* CENTER: Neural Environment */}
      <div className={styles.centerArea}>
        <NeuralEnvironment
          currentStateId={currentState.id}
          currentConfidence={currentState.confidence}
          challengerStateId={challenger?.id}
          challengerConfidence={challenger?.confidence}
          transitionStatus={model.status}
          bandPowers={bandPowers}
          emotionAxes={model.emotionAxes}
          isEmotionallyStable={model.isEmotionallyStable}
          showIntensitySlider={false}
        />
        <SMTransitionBadge state={currentState} />
        <div className={styles.dominantBands}>
          {currentState.dominantBands.map((band: string) => (
            <span key={band} className={styles.bandTag}>{band}</span>
          ))}
        </div>
      </div>

      {/* RIGHT: Challenger */}
      <div className={styles.rightCard}>
        <SMChallengerCard challenger={challenger} />
      </div>
    </div>
  );
}
```

## Visual Behavior Summary

### Orb responds to:
- **Arousal**: Higher glow intensity
- **Control**: Glow moderation (low control = turbulent)
- **Alpha/Theta**: Breathing effect (slow expansion/contraction)
- **BetaH/Gamma**: Surface shimmer speed
- **Valence**: Subtle hue shift (warm for positive, cool for negative)

### Background field responds to:
- **BetaH + low control**: Increased turbulence
- **Alpha/Theta + control**: Calmer flow
- **Higher states**: Aurora effects and radial rays
- **Coherence**: More symmetrical particle movement

### State palettes:
Each mental state has a distinct color palette that crossfades over 3 seconds when states change.

## Customization

### Intensity Slider
User preference persisted to localStorage. Range: 0.5x - 1.5x.

### Reduced Motion
Respects `prefers-reduced-motion` system preference. Can also be toggled manually.

### Smoothing Config
```tsx
const customSmoothing = {
  emaAlpha: 0.15,           // Higher = more responsive
  hueChangeMaxPerSec: 40,   // Faster color transitions
  paletteCrossfadeSec: 2,   // Faster palette changes
};

const visualState = useNeuralVisuals(input, {
  intensity: 1.0,
  reducedMotion: false,
  smoothingConfig: customSmoothing,
});
```
