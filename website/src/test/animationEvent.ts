class AnimationEventAsBrowsersHaveIt extends Event {}

if (!("AnimationEvent" in window)) Object.assign(window, { AnimationEvent: AnimationEventAsBrowsersHaveIt });
