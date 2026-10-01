export class NotificationService {
  static getPermissionStatus(): 'default' | 'granted' | 'denied' | 'unsupported' {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'unsupported';
    }
    return Notification.permission as 'default' | 'granted' | 'denied';
  }

  static async requestPermission(): Promise<boolean> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('Este navegador não suporta notificações desktop');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
      } catch (err) {
        console.error('Erro ao solicitar permissão de notificações:', err);
        return false;
      }
    }

    return false;
  }

  static playNotificationSound() {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';

      // Pleasant ascending two-tone notification
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880.00, now + 0.12); // A5

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.start(now);
      osc.stop(now + 0.45);
    } catch {
      // Audio playback might be silenced until user interaction
    }
  }

  static async notify(title: string, options?: NotificationOptions & { onClick?: () => void }) {
    this.playNotificationSound();

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, {
          icon: '/favicon.ico',
          badge: '/favicon.ico',
          ...options,
        });

        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          if (options?.onClick) {
            options.onClick();
          }
          notification.close();
        };

        return notification;
      } catch (e) {
        console.warn('Erro ao instanciar Notification desktop:', e);
      }
    }
    return null;
  }
}

