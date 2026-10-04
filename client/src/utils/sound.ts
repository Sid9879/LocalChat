// Web Audio API Ringtone & Dial tone Generator (100% offline, zero audio files required)

class SoundManager {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private dialtoneInterval: any = null;

  private getAudioContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  // Play outgoing ringback tone on caller device ("ring... ring...")
  playOutgoingRing() {
    this.stopAll();
    const ctx = this.getAudioContext();

    const ringOnce = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        // Standard US/international telephone ringback frequencies (440Hz + 480Hz)
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.setValueAtTime(440, now);
        osc2.frequency.setValueAtTime(480, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.07, now + 0.05);
        gain.gain.setValueAtTime(0.07, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.25);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 1.3);
        osc2.stop(now + 1.3);
      } catch (e) {
        console.warn('Outgoing ring tone error:', e);
      }
    };

    ringOnce();
    this.dialtoneInterval = setInterval(ringOnce, 3200);
  }

  // Play incoming ringtone on receiver device (melodic digital chime)
  playIncomingRing() {
    this.stopAll();
    const ctx = this.getAudioContext();

    // Notes: C5 (523Hz), E5 (659Hz), G5 (784Hz), C6 (1046Hz)
    const notes = [523.25, 659.25, 783.99, 1046.5];

    const ringOnce = () => {
      if (!this.ctx || this.ctx.state === 'closed') return;
      try {
        const now = ctx.currentTime;

        // First chime arpeggio
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = now + idx * 0.12;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteStart);

          gain.gain.setValueAtTime(0, noteStart);
          gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteStart);
          osc.stop(noteStart + 0.4);
        });

        // Second chime arpeggio
        const secondChime = now + 0.65;
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const noteStart = secondChime + idx * 0.12;

          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, noteStart);

          gain.gain.setValueAtTime(0, noteStart);
          gain.gain.linearRampToValueAtTime(0.12, noteStart + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, noteStart + 0.35);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(noteStart);
          osc.stop(noteStart + 0.4);
        });
      } catch (e) {
        console.warn('Incoming ring tone error:', e);
      }
    };

    ringOnce();
    this.ringtoneInterval = setInterval(ringOnce, 2600);
  }

  // Stop all sounds
  stopAll() {
    if (this.dialtoneInterval) {
      clearInterval(this.dialtoneInterval);
      this.dialtoneInterval = null;
    }
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }
}

export const soundManager = new SoundManager();
