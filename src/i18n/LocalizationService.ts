import { contentTranslations } from './contentTranslations';

export type Language = 'ru' | 'en';

const STORAGE_KEY = 'ashvale-language';
const dictionaries = {
  ru: {
    ...contentTranslations.ru,
    'menu.subtitle': 'ЭХО РАЗЛОМОВ', 'menu.begin': 'НАЧАТЬ ПУТЬ',
    'menu.hint': 'Выберите класс и боевой облик перед входом в Эшвейл',
    'menu.settings': 'НАСТРОЙКИ', 'menu.preview': 'ПРОСМОТР ОБЛИКОВ',
    'menu.devHint': 'Проверка ассетов · клавиша K',
    'menu.controls': 'WASD ДВИЖЕНИЕ · ЛКМ АТАКА · SPACE РЫВОК',
    'settings.title': 'НАСТРОЙКИ', 'settings.language': 'ЯЗЫК', 'settings.close': 'ЗАКРЫТЬ',
    'select.title': 'ВЫБЕРИТЕ ПУТЬ',
    'select.intro': 'Выберите класс и боевой облик, затем войдите в Эшвейл.',
    'select.skin': 'БОЕВОЙ ОБЛИК',
    'select.sideHelp': 'Боковые облики сохраняют последнее направление влево или вправо при вертикальном движении.',
    'select.back': 'НАЗАД', 'select.play': 'ИГРАТЬ', 'select.sideOnly': 'ТОЛЬКО ВИД СБОКУ',
    'class.warrior': 'ВОИН', 'class.archer': 'ЛУЧНИК', 'class.mage': 'МАГ',
    'hud.status': 'Состояние игрока',
    'hud.level': 'Ур. {level}', 'hud.xp': 'ОПЫТ', 'hud.mana': 'МАНА',
    'hud.inventory': 'Инвентарь', 'hud.character': 'Персонаж',
    'hud.inventoryTitle': 'ИНВЕНТАРЬ', 'hud.characterTitle': 'ПЕРСОНАЖ', 'hud.closeHint': 'I / C — закрыть',
    'hud.potions': 'Зелья', 'hud.noEquipment': 'Экипировка пока недоступна',
    'hud.hotbarLocked': 'ЗАКРЫТО', 'hud.minimap': 'Карта местности', 'hud.objectives': 'ЦЕЛИ',
    'objective.slime': 'Победить слизней', 'objective.spider': 'Победить пауков',
    'objective.slimeComplete': 'Цель выполнена: слизни', 'objective.spiderComplete': 'Цель выполнена: пауки',
    'target.slime': 'МШИСТЫЙ СЛИЗЕНЬ', 'target.spider': 'УГОЛЬНЫЙ ПАУК',
    'notify.xp': '+{xp} ОПЫТА', 'notify.level': 'НОВЫЙ УРОВЕНЬ: {level}',
    'potion.health': 'Лечебное зелье', 'potion.mana': 'Зелье маны', 'potion.empty': 'Зелья закончились',
    'potion.healthFull': 'Здоровье уже полное', 'potion.manaFull': 'Мана уже полная',
    'potion.healthUsed': '+30 здоровья', 'potion.manaUsed': '+35 маны',
    'restore.interact': 'Нажмите F, чтобы открыть доску восстановления', 'restore.title': 'ДОСКА ВОССТАНОВЛЕНИЯ',
    'restore.coins': 'МОНЕТЫ: {coins}', 'restore.forge': 'КУЗНИЦА', 'restore.infirmary': 'ЛЕЧЕБНИЦА',
    'restore.restored': 'ВОССТАНОВЛЕНО', 'restore.cost': '{building} · {cost} МОНЕТ', 'restore.price': '{cost} МОНЕТ', 'restore.close': 'ЗАКРЫТЬ',
    'heal.interact': 'Нажмите F, чтобы восстановить здоровье', 'heal.title': 'ЛЕЧЕБНИЦА',
    'heal.health': 'Здоровье: {current} / {max}', 'heal.restore': 'Восстановить {health} HP',
    'heal.healthLabel': 'Здоровье:', 'heal.restoreLabel': 'Восстановить', 'heal.costLabel': 'Стоимость:', 'heal.coinsUnit': 'монет',
    'heal.cost': 'Стоимость: {coins} монет', 'heal.action': 'ВЫЛЕЧИТЬ',
    'heal.notNeeded': 'Лечение не требуется', 'heal.insufficient': 'Недостаточно монет',
    'skill.warrior': 'ТЯЖЁЛЫЙ УДАР', 'skill.archer': 'ПРОБИВНОЙ ВЫСТРЕЛ', 'skill.mage': 'МАГИЧЕСКИЙ ВЗРЫВ',
    'region.slime': 'СУМЕРЕЧНАЯ РОЩА', 'region.hub': 'РУИНЫ ЭШВЕЙЛА', 'region.spider': 'ПАУТИННАЯ ЛОЩИНА',
  },
  en: {
    ...contentTranslations.en,
    'menu.subtitle': 'ECHOES OF THE RIFTS', 'menu.begin': 'BEGIN JOURNEY',
    'menu.hint': 'Choose your class and battle skin before entering Ashvale',
    'menu.settings': 'SETTINGS', 'menu.preview': 'SKIN PREVIEW',
    'menu.devHint': 'DEV asset review · keyboard K',
    'menu.controls': 'WASD MOVE · LMB ATTACK · SPACE DODGE',
    'settings.title': 'SETTINGS', 'settings.language': 'LANGUAGE', 'settings.close': 'CLOSE',
    'select.title': 'CHOOSE YOUR PATH',
    'select.intro': 'Select a class, choose a battle skin, then enter Ashvale.',
    'select.skin': 'BATTLE SKIN',
    'select.sideHelp': 'Side-view skins reuse the last left or right direction during vertical movement.',
    'select.back': 'BACK', 'select.play': 'PLAY', 'select.sideOnly': 'SIDE VIEW ONLY',
    'class.warrior': 'WARRIOR', 'class.archer': 'ARCHER', 'class.mage': 'MAGE',
    'hud.status': 'Player status',
    'hud.level': 'Lv. {level}', 'hud.xp': 'XP', 'hud.mana': 'MANA',
    'hud.inventory': 'Inventory', 'hud.character': 'Character',
    'hud.inventoryTitle': 'INVENTORY', 'hud.characterTitle': 'CHARACTER', 'hud.closeHint': 'I / C — close',
    'hud.potions': 'Potions', 'hud.noEquipment': 'Equipment is not available yet',
    'hud.hotbarLocked': 'LOCKED', 'hud.minimap': 'Area map', 'hud.objectives': 'OBJECTIVES',
    'objective.slime': 'Defeat slimes', 'objective.spider': 'Defeat spiders',
    'objective.slimeComplete': 'Objective complete: slimes', 'objective.spiderComplete': 'Objective complete: spiders',
    'target.slime': 'MOSS SLIME', 'target.spider': 'EMBER SPIDER',
    'notify.xp': '+{xp} XP', 'notify.level': 'LEVEL UP: {level}',
    'potion.health': 'Health potion', 'potion.mana': 'Mana potion', 'potion.empty': 'No potions left',
    'potion.healthFull': 'Health is already full', 'potion.manaFull': 'Mana is already full',
    'potion.healthUsed': '+30 health', 'potion.manaUsed': '+35 mana',
    'restore.interact': 'Press F to open the restoration board', 'restore.title': 'RESTORATION BOARD',
    'restore.coins': 'COINS: {coins}', 'restore.forge': 'FORGE', 'restore.infirmary': 'INFIRMARY',
    'restore.restored': 'RESTORED', 'restore.cost': '{building} · {cost} COINS', 'restore.price': '{cost} COINS', 'restore.close': 'CLOSE',
    'heal.interact': 'Press F to restore health', 'heal.title': 'INFIRMARY',
    'heal.health': 'Health: {current} / {max}', 'heal.restore': 'Restore {health} HP',
    'heal.healthLabel': 'Health:', 'heal.restoreLabel': 'Restore', 'heal.costLabel': 'Cost:', 'heal.coinsUnit': 'coins',
    'heal.cost': 'Cost: {coins} coins', 'heal.action': 'HEAL',
    'heal.notNeeded': 'No treatment needed', 'heal.insufficient': 'Not enough coins',
    'skill.warrior': 'HEAVY SLASH', 'skill.archer': 'PIERCING SHOT', 'skill.mage': 'MAGIC BURST',
    'region.slime': 'TWILIGHT GLADE', 'region.hub': 'ASHVALE RUINS', 'region.spider': 'EMBERWEB HOLLOW',
  },
} as const;

export type TranslationKey = keyof typeof dictionaries.en;

class LocalizationService {
  private activeLanguage: Language = 'ru';

  public load(): Language {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'ru' || saved === 'en') this.activeLanguage = saved;
    } catch (error) {
      console.warn('Language preference could not be loaded.', error);
    }
    document.documentElement.lang = this.activeLanguage;
    return this.activeLanguage;
  }

  public get language(): Language { return this.activeLanguage; }

  public setLanguage(language: Language): void {
    this.activeLanguage = language;
    document.documentElement.lang = language;
    try { localStorage.setItem(STORAGE_KEY, language); }
    catch (error) { console.warn('Language preference could not be saved.', error); }
  }

  public t(key: TranslationKey, values: Record<string, string | number> = {}): string {
    let result: string = dictionaries[this.activeLanguage][key];
    Object.entries(values).forEach(([name, value]) => { result = result.replaceAll(`{${name}}`, String(value)); });
    return result;
  }
}

export const localizationService = new LocalizationService();
export const t = (key: TranslationKey, values?: Record<string, string | number>): string => localizationService.t(key, values);
