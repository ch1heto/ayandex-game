const SDK_URL = 'https://yandex.ru/games/sdk/v2';
const SDK_LOAD_TIMEOUT_MS = 5000;

/**
 * The SDK is fetched only inside the Yandex iframe. Local development keeps
 * the console clean and starts immediately through the service fallback.
 */
export function loadYandexGamesSdk(): Promise<void> {
  if (typeof YaGames !== 'undefined' || window.self === window.top) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(resolve, SDK_LOAD_TIMEOUT_MS);

    const finish = (): void => {
      window.clearTimeout(timeout);
      resolve();
    };

    script.src = SDK_URL;
    script.onload = finish;
    script.onerror = finish;
    document.head.append(script);
  });
}
