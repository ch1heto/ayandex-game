import './style.css';
import { createGame } from './core/createGame';
import { loadYandexGamesSdk } from './yandex/loadYandexGamesSdk';

void loadYandexGamesSdk().then(() => createGame('app'));
