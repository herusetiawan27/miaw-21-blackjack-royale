// Keyboard and pointer input. One-shot presses (deal, hit, stand, …) are queued as named
// actions and taken once by the loop, so a press between two frames is never lost and never
// counted twice. Held keys are not needed: blackjack is turn-based.

export function createInput(stage, onAction) {
  let queue = [];

  function push(action) {
    queue.push(action);
  }

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    const code = event.code;
    if (code === 'Digit1') push('chip10');
    else if (code === 'Digit2') push('chip20');
    else if (code === 'Digit3') push('chip50');
    else if (code === 'Digit4') push('chip100');
    else if (code === 'Digit5') push('chipmax');
    else if (code === 'KeyC') push('clear');
    else if (code === 'KeyB') push('repeat');
    else if (code === 'KeyH') push('hit');
    else if (code === 'KeyS') push('stand');
    else if (code === 'KeyD') push('double');
    else if (code === 'KeyK') push('peek');
    else if (code === 'KeyN') push('next');
    else if (code === 'KeyR') push('restart');
    else if (code === 'KeyM') push('mute');
    else if (code === 'KeyP' || code === 'Escape') push('pause');
    else if (code === 'Enter' || code === 'Space') push('confirm');
    else return;
    event.preventDefault();
  });

  // Buttons are real buttons: click them, or tab to them and press Enter.
  stage.addEventListener('click', (event) => {
    const target = event.target.closest('[data-action]');
    if (!target || target.disabled) return;
    push(target.dataset.action === 'chip' ? 'chip' + target.dataset.value : target.dataset.action);
  });

  return {
    /** The actions queued since the last call, in order. */
    takeActions() {
      const taken = queue;
      queue = [];
      return taken;
    },
  };
}
