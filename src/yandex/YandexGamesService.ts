import type { SDK } from 'ysdk';

export type PlatformKind = 'yandex' | 'local';

export interface PlatformEnvironment {
  readonly platform: PlatformKind;
  readonly language: string;
}

type LifecycleListener = () => void;

/**
 * The only module that knows about the Yandex Games global SDK. Gameplay
 * systems consume this service instead of calling SDK methods directly.
 */
export class YandexGamesService {
  private sdk: SDK | undefined;
  private environment: PlatformEnvironment = {
    platform: 'local',
    language: navigator.language.slice(0, 2) || 'en',
  };
  private initialized = false;
  private gameReady = false;
  private readonly pauseListeners = new Set<LifecycleListener>();
  private readonly resumeListeners = new Set<LifecycleListener>();

  public async initialize(): Promise<PlatformEnvironment> {
    if (this.initialized) {
      return this.environment;
    }

    this.initialized = true;
    this.installBrowserLifecycleFallback();

    if (typeof YaGames === 'undefined') {
      return this.environment;
    }

    try {
      this.sdk = await YaGames.init();
      this.environment = {
        platform: 'yandex',
        language: this.sdk.environment.i18n.lang,
      };
      this.sdk.on('game_api_pause', this.emitPause);
      this.sdk.on('game_api_resume', this.emitResume);
    } catch (error) {
      console.warn('Yandex Games SDK is unavailable; using local development fallback.', error);
    }

    return this.environment;
  }

  public markGameReady(): void {
    if (this.gameReady) {
      return;
    }

    this.gameReady = true;
    this.sdk?.features.LoadingAPI.ready();
  }

  public onPause(listener: LifecycleListener): () => void {
    this.pauseListeners.add(listener);
    return () => this.pauseListeners.delete(listener);
  }

  public onResume(listener: LifecycleListener): () => void {
    this.resumeListeners.add(listener);
    return () => this.resumeListeners.delete(listener);
  }

  public getEnvironment(): PlatformEnvironment {
    return this.environment;
  }

  private installBrowserLifecycleFallback(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.emitPause();
      } else {
        this.emitResume();
      }
    });

    window.addEventListener('blur', this.emitPause);
    window.addEventListener('focus', this.emitResume);
  }

  private readonly emitPause = (): void => {
    this.pauseListeners.forEach((listener) => listener());
  };

  private readonly emitResume = (): void => {
    this.resumeListeners.forEach((listener) => listener());
  };
}

export const yandexGamesService = new YandexGamesService();
