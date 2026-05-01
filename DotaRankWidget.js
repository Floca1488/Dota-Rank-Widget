// DotaRankWidget.js
// Remote core for DotaRank Widget v2.
// User settings are passed from Scriptable Loader.

const DOTARANK_VERSION = "2.0.1";

const USER_CONFIG = globalThis.DOTARANK_CONFIG || {};

const ACCOUNT_ID = String(USER_CONFIG.accountId || "1643456704");
const START_PTS = Number(USER_CONFIG.startPts ?? 2169);

const RESET_PTS = Boolean(USER_CONFIG.resetPts || false);
const RESET_ICON_STYLE = Boolean(USER_CONFIG.resetIconStyle || false);
const CLEAR_ICON_CACHE = Boolean(USER_CONFIG.clearIconCache || false);

const MANUAL_PTS_OVERRIDE =
  USER_CONFIG.manualPtsOverride === null ||
  USER_CONFIG.manualPtsOverride === undefined
    ? null
    : Number(USER_CONFIG.manualPtsOverride);

const PTS_WIN = Number(USER_CONFIG.ptsWin ?? 25);
const PTS_LOSS = Number(USER_CONFIG.ptsLoss ?? 25);

const TRACK_RANKED_ONLY = USER_CONFIG.trackRankedOnly !== false;

const PREVIEW_SIZE = USER_CONFIG.previewSize || "small";
const LANGUAGE = USER_CONFIG.language || "ru";
const THEME = USER_CONFIG.theme || "purple";

const GITHUB_RAW_BASE =
  USER_CONFIG.githubRawBase ||
  "https://raw.githubusercontent.com/Floca1488/Dota-Rank-Widget/main/icons";

// =========================
// LOCALIZATION
// =========================

const I18N = {
  ru: {
    rank: "РАНГ",
    currentRank: "ТЕКУЩИЙ РАНГ",
    pts: "ПТС",
    next: "До",
    maxRank: "Макс. ранг",
    last: "ПОСЛЕДНИЙ",
    lastMatch: "ПОСЛЕДНИЙ МАТЧ",
    kda: "KDA",
    hero: "Герой",
    wins: "Победы",
    losses: "Поражения",
    winrate: "Винрейт",
    total: "Всего",
    last20: "20 игр",
    streak: "Серия",
    form: "ФОРМА",
    record: "Счёт",
    updated: "Обновлено",
    noData: "Нет данных",
    noMatch: "Нет матча",
    styleTitle: "DotaRank Widget",
    styleMessage: "Выбери стиль иконок",
    defaultStyle: "Default",
    umbrellaStyle: "Umbrella"
  },
  en: {
    rank: "RANK",
    currentRank: "CURRENT RANK",
    pts: "PTS",
    next: "To",
    maxRank: "Max rank",
    last: "LAST",
    lastMatch: "LAST MATCH",
    kda: "KDA",
    hero: "Hero",
    wins: "Wins",
    losses: "Losses",
    winrate: "Winrate",
    total: "Total",
    last20: "Last 20",
    streak: "Streak",
    form: "FORM",
    record: "Record",
    updated: "Updated",
    noData: "No data",
    noMatch: "No match",
    styleTitle: "DotaRank Widget",
    styleMessage: "Choose rank icon style",
    defaultStyle: "Default",
    umbrellaStyle: "Umbrella"
  }
};

const T = I18N[LANGUAGE] || I18N.ru;

// =========================
// THEMES
// =========================

const THEMES = {
  purple: {
    bgTop: "#09090B",
    bgBottom: "#201126",
    accent: "#D8B4FE",
    cardStrong: 0.13,
    cardSoft: 0.075
  },
  dark: {
    bgTop: "#050505",
    bgBottom: "#151515",
    accent: "#FFFFFF",
    cardStrong: 0.12,
    cardSoft: 0.07
  },
  blue: {
    bgTop: "#06111F",
    bgBottom: "#0B2545",
    accent: "#93C5FD",
    cardStrong: 0.13,
    cardSoft: 0.075
  },
  red: {
    bgTop: "#140606",
    bgBottom: "#2A0B0B",
    accent: "#FCA5A5",
    cardStrong: 0.13,
    cardSoft: 0.075
  },
  gold: {
    bgTop: "#0E0B05",
    bgBottom: "#2A1E0A",
    accent: "#FDE68A",
    cardStrong: 0.13,
    cardSoft: 0.075
  }
};

const THEME_DATA = THEMES[THEME] || THEMES.purple;

const BG_TOP = new Color(THEME_DATA.bgTop);
const BG_BOTTOM = new Color(THEME_DATA.bgBottom);

const CARD_STRONG = new Color("#FFFFFF", THEME_DATA.cardStrong);
const CARD_SOFT = new Color("#FFFFFF", THEME_DATA.cardSoft);

const TEXT = Color.white();
const MUTED = new Color("#C7C7D1");
const SUBTLE = new Color("#9B9BA7");
const ACCENT = new Color(THEME_DATA.accent);

const WIN = new Color("#86EFAC");
const LOSS = new Color("#FCA5A5");

// =========================
// STORAGE KEYS
// =========================

const STORAGE_KEY_PTS = `dota_pts_${ACCOUNT_ID}`;
const STORAGE_KEY_MATCH = `dota_last_ranked_match_${ACCOUNT_ID}`;
const STORAGE_ICON_STYLE = `dota_icon_style_${ACCOUNT_ID}`;

// =========================
// MAIN
// =========================

const widget = await createWidget();
widget.refreshAfterDate = new Date(Date.now() + 15 * 60 * 1000);

Script.setWidget(widget);

if (!config.runsInWidget) {
  await presentWidget(widget);
}

Script.complete();

async function presentWidget(widgetToPresent) {
  if (PREVIEW_SIZE === "large") {
    await widgetToPresent.presentLarge();
  } else if (PREVIEW_SIZE === "medium") {
    await widgetToPresent.presentMedium();
  } else {
    await widgetToPresent.presentSmall();
  }
}

async function createWidget() {
  const w = new ListWidget();
  const family = config.widgetFamily || PREVIEW_SIZE;

  const gradient = new LinearGradient();
  gradient.colors = [BG_TOP, BG_BOTTOM];
  gradient.locations = [0, 1];
  w.backgroundGradient = gradient;

  try {
    const data = await loadData();

    if (family === "large") {
      await buildLarge(w, data);
    } else if (family === "medium") {
      await buildMedium(w, data);
    } else {
      await buildSmall(w, data);
    }
  } catch (e) {
    buildError(w, e);
  }

  w.url = `https://www.opendota.com/players/${ACCOUNT_ID}`;
  return w;
}

// =========================
// DATA
// =========================

async function loadData() {
  const iconStyle = await getIconStyle();

  const player = await safeFetchJson(
    `https://api.opendota.com/api/players/${ACCOUNT_ID}`,
    {}
  );

  const recent = await safeFetchJson(
    `https://api.opendota.com/api/players/${ACCOUNT_ID}/recentMatches`,
    []
  );

  const wl = await safeFetchJson(
    `https://api.opendota.com/api/players/${ACCOUNT_ID}/wl`,
    {}
  );

  const heroes = await getHeroesMap();

  const name = player?.profile?.personaname || "Dota Player";
  const avatarUrl = player?.profile?.avatarfull || player?.profile?.avatarmedium || null;
  const avatar = avatarUrl ? await safeFetchImage(avatarUrl, null) : null;

  const matches = Array.isArray(recent) ? recent : [];

  const shownMatches = TRACK_RANKED_ONLY
    ? matches.filter(isTrackedMatch)
    : matches;

  const displayMatch = shownMatches.length > 0 ? shownMatches[0] : null;

  const lastResult = displayMatch ? getMatchResult(displayMatch) : "No match";
  const kda = displayMatch
    ? `${displayMatch.kills}/${displayMatch.deaths}/${displayMatch.assists}`
    : "—";
  const heroName = displayMatch ? getHeroName(displayMatch.hero_id, heroes) : "—";

  const ptsData = updatePtsFromMatches(matches);
  const pts = ptsData.pts;

  const rankData = getRankByPts(pts);
  const progress = getRankProgress(pts);

  let rankImage = null;

  try {
    rankImage = await loadRankImage(rankData.fileName, iconStyle);
  } catch (e) {
    rankImage = null;
  }

  const totalWins = Number(wl?.win ?? 0);
  const totalLosses = Number(wl?.lose ?? 0);
  const totalGames = totalWins + totalLosses;
  const totalWr = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

  const last20 = getLastNStats(shownMatches, 20);
  const streak = getStreak(shownMatches);

  return {
    name,
    avatar,
    lastResult,
    kda,
    heroName,
    pts,
    ptsChangeText: ptsData.changeText,
    rankTitle: rankData.title,
    rankFileName: rankData.fileName,
    rankImage,
    iconStyle,
    progress,
    totalWins,
    totalLosses,
    totalGames,
    totalWr,
    last20,
    streak,
    updated: formatTime(new Date())
  };
}

// =========================
// ICON STYLE
// =========================

async function getIconStyle() {
  if (RESET_ICON_STYLE && Keychain.contains(STORAGE_ICON_STYLE)) {
    Keychain.remove(STORAGE_ICON_STYLE);
  }

  if (Keychain.contains(STORAGE_ICON_STYLE)) {
    return Keychain.get(STORAGE_ICON_STYLE);
  }

  if (config.runsInWidget) {
    Keychain.set(STORAGE_ICON_STYLE, "default");
    return "default";
  }

  const alert = new Alert();
  alert.title = T.styleTitle;
  alert.message = T.styleMessage;
  alert.addAction(T.defaultStyle);
  alert.addAction(T.umbrellaStyle);

  const result = await alert.presentAlert();
  const style = result === 1 ? "umbrella" : "default";

  Keychain.set(STORAGE_ICON_STYLE, style);
  return style;
}

async function loadRankImage(fileName, iconStyle) {
  const fm = FileManager.local();

  const cacheFolder = fm.joinPath(
    fm.documentsDirectory(),
    `dota_rank_icons_${iconStyle}`
  );

  if (CLEAR_ICON_CACHE && fm.fileExists(cacheFolder)) {
    try {
      fm.remove(cacheFolder);
    } catch (e) {
      // Ignore cache removal errors and try to use or recreate the folder.
    }
  }

  if (!fm.fileExists(cacheFolder)) {
    fm.createDirectory(cacheFolder);
  }

  const localPath = fm.joinPath(cacheFolder, `${fileName}.png`);

  if (fm.fileExists(localPath)) {
    return fm.readImage(localPath);
  }

  const url = `${GITHUB_RAW_BASE}/${iconStyle}/${fileName}.png`;

  const req = new Request(url);
  req.headers = {
    "User-Agent": "DotaRankWidget"
  };

  const image = await req.loadImage();
  fm.writeImage(localPath, image);

  return image;
}

// =========================
// PTS AUTO TRACKING
// =========================

function updatePtsFromMatches(matches) {
  if (MANUAL_PTS_OVERRIDE !== null && isFinite(MANUAL_PTS_OVERRIDE)) {
    const manualPts = Math.round(MANUAL_PTS_OVERRIDE);
    Keychain.set(STORAGE_KEY_PTS, String(manualPts));

    const latestTracked = getLatestTrackedMatch(matches);
    if (latestTracked?.match_id) {
      Keychain.set(STORAGE_KEY_MATCH, String(latestTracked.match_id));
    }

    return {
      pts: manualPts,
      changed: false,
      changeText: ""
    };
  }

  if (RESET_PTS || !Keychain.contains(STORAGE_KEY_PTS)) {
    Keychain.set(STORAGE_KEY_PTS, String(START_PTS));

    const latestTracked = getLatestTrackedMatch(matches);
    if (latestTracked?.match_id) {
      Keychain.set(STORAGE_KEY_MATCH, String(latestTracked.match_id));
    }

    return {
      pts: START_PTS,
      changed: false,
      changeText: ""
    };
  }

  let pts = Number(Keychain.get(STORAGE_KEY_PTS));

  if (isNaN(pts)) {
    pts = START_PTS;
    Keychain.set(STORAGE_KEY_PTS, String(pts));
  }

  const trackedMatches = matches.filter(isTrackedMatch);

  if (trackedMatches.length === 0) {
    return {
      pts,
      changed: false,
      changeText: ""
    };
  }

  const savedMatchId = Keychain.contains(STORAGE_KEY_MATCH)
    ? Keychain.get(STORAGE_KEY_MATCH)
    : "";

  if (!savedMatchId) {
    Keychain.set(STORAGE_KEY_MATCH, String(trackedMatches[0].match_id));

    return {
      pts,
      changed: false,
      changeText: ""
    };
  }

  const savedIndex = trackedMatches.findIndex(
    m => String(m.match_id) === String(savedMatchId)
  );

  let newMatches = [];

  if (savedIndex === -1) {
    Keychain.set(STORAGE_KEY_MATCH, String(trackedMatches[0].match_id));

    return {
      pts,
      changed: false,
      changeText: ""
    };
  } else if (savedIndex > 0) {
    newMatches = trackedMatches.slice(0, savedIndex);
  }

  if (newMatches.length === 0) {
    return {
      pts,
      changed: false,
      changeText: ""
    };
  }

  let totalChange = 0;

  newMatches.reverse();

  for (const match of newMatches) {
    const result = getMatchResult(match);
    const change = result === "Win" ? PTS_WIN : -PTS_LOSS;

    pts += change;
    totalChange += change;
  }

  Keychain.set(STORAGE_KEY_PTS, String(pts));
  Keychain.set(STORAGE_KEY_MATCH, String(trackedMatches[0].match_id));

  return {
    pts,
    changed: true,
    changeText: totalChange === 0
      ? ""
      : totalChange > 0
        ? `+${totalChange}`
        : `${totalChange}`
  };
}

function getLatestTrackedMatch(matches) {
  if (!Array.isArray(matches)) return null;
  return matches.find(isTrackedMatch) || null;
}

function isTrackedMatch(match) {
  if (!match) return false;
  if (!TRACK_RANKED_ONLY) return true;

  return match.lobby_type === 7;
}

// =========================
// SMALL
// =========================

async function buildSmall(w, data) {
  w.setPadding(10, 10, 9, 10);

  addHeader(w, data, {
    avatarSize: 25,
    gameFont: 8,
    nameFont: 13
  });

  w.addSpacer(7);

  const card = w.addStack();
  card.layoutVertically();
  card.backgroundColor = CARD_STRONG;
  card.cornerRadius = 15;
  card.setPadding(7, 9, 8, 9);

  addSectionLabel(card, T.rank, 8);
  card.addSpacer(3);

  const rankRow = card.addStack();
  rankRow.layoutHorizontally();
  rankRow.centerAlignContent();

  if (data.rankImage) {
    const icon = rankRow.addImage(data.rankImage);
    icon.imageSize = new Size(38, 38);
    rankRow.addSpacer(6);
  }

  const rankText = rankRow.addText(data.rankTitle);
  rankText.font = Font.boldSystemFont(13);
  rankText.textColor = TEXT;
  rankText.lineLimit = 1;
  rankText.minimumScaleFactor = 0.5;

  card.addSpacer(4);

  const pts = card.addText(getPtsLine(data, false));
  pts.font = Font.boldSystemFont(15);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.75;

  card.addSpacer(4);

  const next = card.addText(getProgressText(data.progress));
  next.font = Font.mediumSystemFont(8);
  next.textColor = MUTED;
  next.lineLimit = 1;
  next.minimumScaleFactor = 0.6;

  card.addSpacer(4);
  addProgressBar(card, data.progress.percent, 112, 5, ACCENT);

  w.addSpacer();

  const bottom = w.addStack();
  bottom.layoutHorizontally();
  bottom.centerAlignContent();

  const wr = bottom.addText(`${T.winrate} ${formatPercent(data.totalWr)}`);
  wr.font = Font.mediumSystemFont(9);
  wr.textColor = MUTED;
  wr.lineLimit = 1;
  wr.minimumScaleFactor = 0.6;

  bottom.addSpacer();

  const updated = bottom.addText(data.updated);
  updated.font = Font.systemFont(8);
  updated.textColor = SUBTLE;
  updated.textOpacity = 0.65;
}

// =========================
// MEDIUM
// =========================

async function buildMedium(w, data) {
  w.setPadding(12, 13, 11, 13);

  addHeader(w, data, {
    avatarSize: 30,
    gameFont: 8,
    nameFont: 17
  });

  w.addSpacer(9);

  const content = w.addStack();
  content.layoutHorizontally();
  content.topAlignContent();

  const rankCard = content.addStack();
  rankCard.layoutVertically();
  rankCard.backgroundColor = CARD_STRONG;
  rankCard.cornerRadius = 18;
  rankCard.setPadding(9, 10, 9, 10);
  rankCard.size = new Size(172, 0);

  addSectionLabel(rankCard, T.currentRank, 8);
  rankCard.addSpacer(5);

  const rankRow = rankCard.addStack();
  rankRow.layoutHorizontally();
  rankRow.centerAlignContent();

  if (data.rankImage) {
    const rankImg = rankRow.addImage(data.rankImage);
    rankImg.imageSize = new Size(52, 52);
    rankRow.addSpacer(8);
  }

  const rankName = rankRow.addText(data.rankTitle);
  rankName.font = Font.boldSystemFont(16);
  rankName.textColor = TEXT;
  rankName.lineLimit = 1;
  rankName.minimumScaleFactor = 0.5;

  rankCard.addSpacer(6);

  const pts = rankCard.addText(getPtsLine(data, true));
  pts.font = Font.boldSystemFont(18);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.65;

  rankCard.addSpacer(4);

  const next = rankCard.addText(getProgressText(data.progress));
  next.font = Font.mediumSystemFont(8);
  next.textColor = MUTED;
  next.lineLimit = 1;
  next.minimumScaleFactor = 0.6;

  rankCard.addSpacer(5);
  addProgressBar(rankCard, data.progress.percent, 142, 6, ACCENT);

  content.addSpacer(8);

  const right = content.addStack();
  right.layoutVertically();

  const matchCard = right.addStack();
  matchCard.layoutVertically();
  matchCard.backgroundColor = getResultBg(data.lastResult);
  matchCard.cornerRadius = 17;
  matchCard.setPadding(8, 9, 8, 9);
  matchCard.size = new Size(109, 0);

  addSectionLabel(matchCard, T.last, 8);
  matchCard.addSpacer(4);

  const line1 = matchCard.addStack();
  line1.layoutHorizontally();
  line1.centerAlignContent();

  const result = line1.addText(getShortResult(data.lastResult));
  result.font = Font.boldSystemFont(23);
  result.textColor = getResultColor(data.lastResult);

  line1.addSpacer(6);

  const kda = line1.addText(data.kda);
  kda.font = Font.boldSystemFont(11);
  kda.textColor = TEXT;
  kda.lineLimit = 1;
  kda.minimumScaleFactor = 0.5;

  matchCard.addSpacer(3);

  const hero = matchCard.addText(data.heroName);
  hero.font = Font.mediumSystemFont(8);
  hero.textColor = MUTED;
  hero.lineLimit = 1;
  hero.minimumScaleFactor = 0.5;

  right.addSpacer(7);

  const statsCard = right.addStack();
  statsCard.layoutVertically();
  statsCard.backgroundColor = CARD_SOFT;
  statsCard.cornerRadius = 17;
  statsCard.setPadding(8, 9, 8, 9);
  statsCard.size = new Size(109, 0);

  const streak = statsCard.addText(`${T.streak}: ${data.streak.text}`);
  streak.font = Font.boldSystemFont(10);
  streak.textColor = getStreakColor(data.streak.type);
  streak.lineLimit = 1;
  streak.minimumScaleFactor = 0.7;

  statsCard.addSpacer(3);

  const wr20 = statsCard.addText(`${T.last20}: ${formatPercent(data.last20.wr)}`);
  wr20.font = Font.mediumSystemFont(8);
  wr20.textColor = MUTED;
  wr20.lineLimit = 1;
  wr20.minimumScaleFactor = 0.6;

  statsCard.addSpacer(3);

  const total = statsCard.addText(`W ${data.totalWins} · L ${data.totalLosses}`);
  total.font = Font.mediumSystemFont(8);
  total.textColor = SUBTLE;
  total.lineLimit = 1;
  total.minimumScaleFactor = 0.55;
}

// =========================
// LARGE
// =========================

async function buildLarge(w, data) {
  w.setPadding(15, 15, 14, 15);

  addHeader(w, data, {
    avatarSize: 36,
    gameFont: 9,
    nameFont: 21
  });

  w.addSpacer(12);

  const rankCard = w.addStack();
  rankCard.layoutHorizontally();
  rankCard.backgroundColor = CARD_STRONG;
  rankCard.cornerRadius = 23;
  rankCard.setPadding(13, 14, 13, 14);

  if (data.rankImage) {
    const rankImg = rankCard.addImage(data.rankImage);
    rankImg.imageSize = new Size(78, 78);
    rankCard.addSpacer(13);
  }

  const rankInfo = rankCard.addStack();
  rankInfo.layoutVertically();

  addSectionLabel(rankInfo, T.currentRank, 10);
  rankInfo.addSpacer(5);

  const rank = rankInfo.addText(data.rankTitle);
  rank.font = Font.boldSystemFont(26);
  rank.textColor = TEXT;
  rank.lineLimit = 1;
  rank.minimumScaleFactor = 0.65;

  rankInfo.addSpacer(5);

  const pts = rankInfo.addText(getPtsLine(data, true));
  pts.font = Font.boldSystemFont(27);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.65;

  rankInfo.addSpacer(5);

  const next = rankInfo.addText(getProgressText(data.progress));
  next.font = Font.mediumSystemFont(10);
  next.textColor = MUTED;
  next.lineLimit = 1;
  next.minimumScaleFactor = 0.65;

  rankInfo.addSpacer(6);
  addProgressBar(rankInfo, data.progress.percent, 198, 7, ACCENT);

  w.addSpacer(11);

  const row = w.addStack();
  row.layoutHorizontally();

  const matchCard = row.addStack();
  matchCard.layoutVertically();
  matchCard.backgroundColor = getResultBg(data.lastResult);
  matchCard.cornerRadius = 22;
  matchCard.setPadding(11, 12, 11, 12);
  matchCard.size = new Size(162, 0);

  addSectionLabel(matchCard, T.lastMatch, 10);
  matchCard.addSpacer(7);

  const matchRow = matchCard.addStack();
  matchRow.layoutHorizontally();
  matchRow.centerAlignContent();

  const result = matchRow.addText(getShortResult(data.lastResult));
  result.font = Font.boldSystemFont(32);
  result.textColor = getResultColor(data.lastResult);

  matchRow.addSpacer(10);

  const kda = matchRow.addText(`${T.kda} ${data.kda}`);
  kda.font = Font.boldSystemFont(15);
  kda.textColor = TEXT;
  kda.lineLimit = 1;
  kda.minimumScaleFactor = 0.6;

  matchCard.addSpacer(5);

  const hero = matchCard.addText(`${T.hero}: ${data.heroName}`);
  hero.font = Font.mediumSystemFont(10);
  hero.textColor = MUTED;
  hero.lineLimit = 1;
  hero.minimumScaleFactor = 0.6;

  row.addSpacer(8);

  const formCard = row.addStack();
  formCard.layoutVertically();
  formCard.backgroundColor = CARD_SOFT;
  formCard.cornerRadius = 22;
  formCard.setPadding(11, 12, 11, 12);
  formCard.size = new Size(124, 0);

  addSectionLabel(formCard, T.form, 10);
  formCard.addSpacer(7);

  const streak = formCard.addText(data.streak.text);
  streak.font = Font.boldSystemFont(23);
  streak.textColor = getStreakColor(data.streak.type);
  streak.lineLimit = 1;

  formCard.addSpacer(6);

  const wr20 = formCard.addText(`${T.last20}: ${formatPercent(data.last20.wr)}`);
  wr20.font = Font.boldSystemFont(11);
  wr20.textColor = TEXT;
  wr20.lineLimit = 1;
  wr20.minimumScaleFactor = 0.65;

  const record20 = formCard.addText(`${data.last20.wins}W / ${data.last20.losses}L`);
  record20.font = Font.mediumSystemFont(9);
  record20.textColor = SUBTLE;
  record20.lineLimit = 1;

  w.addSpacer(11);

  const stats = w.addStack();
  stats.layoutHorizontally();

  addStatBox(stats, T.wins, String(data.totalWins), WIN);
  stats.addSpacer(8);
  addStatBox(stats, T.losses, String(data.totalLosses), LOSS);
  stats.addSpacer(8);
  addStatBox(stats, T.winrate, formatPercent(data.totalWr), TEXT);

  w.addSpacer();

  const footer = w.addStack();
  footer.layoutHorizontally();

  const updated = footer.addText(`${T.updated} ${data.updated}`);
  updated.font = Font.systemFont(10);
  updated.textColor = SUBTLE;
  updated.textOpacity = 0.7;

  footer.addSpacer();

  const source = footer.addText(`${data.iconStyle} · ${THEME} · v${DOTARANK_VERSION}`);
  source.font = Font.systemFont(10);
  source.textColor = SUBTLE;
  source.textOpacity = 0.6;
}

// =========================
// UI HELPERS
// =========================

function addHeader(parent, data, opts) {
  const header = parent.addStack();
  header.layoutHorizontally();
  header.centerAlignContent();

  if (data.avatar) {
    const avatar = header.addImage(data.avatar);
    avatar.imageSize = new Size(opts.avatarSize, opts.avatarSize);
    avatar.cornerRadius = opts.avatarSize / 2;
    header.addSpacer(8);
  }

  const headerText = header.addStack();
  headerText.layoutVertically();

  const game = headerText.addText("DOTA 2");
  game.font = Font.mediumSystemFont(opts.gameFont);
  game.textColor = ACCENT;
  game.textOpacity = 0.95;

  const name = headerText.addText(data.name);
  name.font = Font.boldSystemFont(opts.nameFont);
  name.textColor = TEXT;
  name.lineLimit = 1;
  name.minimumScaleFactor = 0.75;
}

function addSectionLabel(parent, text, size) {
  const t = parent.addText(text);
  t.font = Font.mediumSystemFont(size);
  t.textColor = MUTED;
  t.textOpacity = 0.82;
}

function addStatBox(parent, label, value, color) {
  const box = parent.addStack();
  box.layoutVertically();
  box.backgroundColor = CARD_SOFT;
  box.cornerRadius = 18;
  box.setPadding(9, 10, 9, 10);
  box.size = new Size(90, 0);

  const l = box.addText(label);
  l.font = Font.mediumSystemFont(8);
  l.textColor = MUTED;
  l.lineLimit = 1;
  l.minimumScaleFactor = 0.6;

  box.addSpacer(4);

  const v = box.addText(value);
  v.font = Font.boldSystemFont(18);
  v.textColor = color;
  v.lineLimit = 1;
  v.minimumScaleFactor = 0.6;
}

function addProgressBar(parent, percent, width, height, color) {
  const image = parent.addImage(makeProgressBar(percent, width, height, color));
  image.imageSize = new Size(width, height);
}

function makeProgressBar(percent, width, height, color) {
  const p = Math.max(0, Math.min(1, percent));

  const dc = new DrawContext();
  dc.size = new Size(width, height);
  dc.opaque = false;
  dc.respectScreenScale = true;

  dc.setFillColor(new Color("#FFFFFF", 0.16));
  fillCapsule(dc, 0, 0, width, height);

  const fillWidth = width * p;

  if (fillWidth > 0) {
    dc.setFillColor(color);
    fillCapsule(dc, 0, 0, fillWidth, height);
  }

  return dc.getImage();
}

function fillCapsule(dc, x, y, width, height) {
  if (width <= 0 || height <= 0) return;

  if (width <= height) {
    dc.fillEllipse(new Rect(x, y, width, height));
    return;
  }

  const radius = height / 2;

  dc.fillRect(new Rect(x + radius, y, width - height, height));
  dc.fillEllipse(new Rect(x, y, height, height));
  dc.fillEllipse(new Rect(x + width - height, y, height, height));
}

function getShortResult(result) {
  if (result === "Win") return "W";
  if (result === "Loss") return "L";
  return "—";
}

function getResultColor(result) {
  if (result === "Win") return WIN;
  if (result === "Loss") return LOSS;
  return MUTED;
}

function getResultBg(result) {
  if (result === "Win") return new Color("#22C55E", 0.13);
  if (result === "Loss") return new Color("#EF4444", 0.13);
  return CARD_SOFT;
}

function getStreakColor(type) {
  if (type === "W") return WIN;
  if (type === "L") return LOSS;
  return MUTED;
}

function getPtsLine(data, includeDelta) {
  if (includeDelta && data.ptsChangeText) {
    return `${T.pts} ${data.pts} ${data.ptsChangeText}`;
  }

  return `${T.pts} ${data.pts}`;
}

function getProgressText(progress) {
  if (progress.isMax) {
    return T.maxRank;
  }

  return `${T.next} ${progress.nextTitle}: ${progress.remaining}`;
}

function formatPercent(value) {
  if (!isFinite(value)) return "0%";
  return `${value.toFixed(1)}%`;
}

// =========================
// STATS HELPERS
// =========================

function getLastNStats(matches, n) {
  const list = Array.isArray(matches) ? matches.slice(0, n) : [];
  let wins = 0;
  let losses = 0;

  for (const match of list) {
    const result = getMatchResult(match);

    if (result === "Win") {
      wins++;
    } else if (result === "Loss") {
      losses++;
    }
  }

  const total = wins + losses;
  const wr = total > 0 ? (wins / total) * 100 : 0;

  return {
    wins,
    losses,
    total,
    wr
  };
}

function getStreak(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      type: "",
      count: 0,
      text: "—"
    };
  }

  const first = getMatchResult(matches[0]);
  let count = 0;

  for (const match of matches) {
    const result = getMatchResult(match);

    if (result === first) {
      count++;
    } else {
      break;
    }
  }

  const type = first === "Win" ? "W" : first === "Loss" ? "L" : "";

  return {
    type,
    count,
    text: type ? `${type}${count}` : "—"
  };
}

// =========================
// RANKS BY PTS
// =========================

function getRankByPts(pts) {
  const ranks = getRanks();
  let current = ranks[0];

  for (const rank of ranks) {
    if (pts >= rank.min) {
      current = rank;
    } else {
      break;
    }
  }

  const title = current.name === "Immortal"
    ? "Immortal"
    : `${current.name} ${current.star}`;

  return {
    ...current,
    title,
    fileName: current.file
  };
}

function getRankProgress(pts) {
  const ranks = getRanks();
  const current = getRankByPts(pts);
  const currentIndex = ranks.findIndex(r => r.file === current.file);
  const next = ranks[currentIndex + 1];

  if (!next) {
    return {
      isMax: true,
      nextTitle: "",
      remaining: 0,
      percent: 1
    };
  }

  const start = current.min;
  const end = next.min;
  const total = end - start;
  const done = pts - start;
  const percent = total > 0 ? done / total : 1;

  const nextTitle =
    next.name === "Immortal" ? "Immortal" : `${next.name} ${next.star}`;

  return {
    isMax: false,
    nextTitle,
    remaining: Math.max(0, next.min - pts),
    percent
  };
}

function getRanks() {
  return [
    { min: 0,    name: "Herald",   file: "herald_1",   star: "I" },
    { min: 154,  name: "Herald",   file: "herald_2",   star: "II" },
    { min: 308,  name: "Herald",   file: "herald_3",   star: "III" },
    { min: 462,  name: "Herald",   file: "herald_4",   star: "IV" },
    { min: 616,  name: "Herald",   file: "herald_5",   star: "V" },

    { min: 770,  name: "Guardian", file: "guardian_1", star: "I" },
    { min: 924,  name: "Guardian", file: "guardian_2", star: "II" },
    { min: 1078, name: "Guardian", file: "guardian_3", star: "III" },
    { min: 1232, name: "Guardian", file: "guardian_4", star: "IV" },
    { min: 1386, name: "Guardian", file: "guardian_5", star: "V" },

    { min: 1540, name: "Crusader", file: "crusader_1", star: "I" },
    { min: 1694, name: "Crusader", file: "crusader_2", star: "II" },
    { min: 1848, name: "Crusader", file: "crusader_3", star: "III" },
    { min: 2002, name: "Crusader", file: "crusader_4", star: "IV" },
    { min: 2156, name: "Crusader", file: "crusader_5", star: "V" },

    { min: 2310, name: "Archon",   file: "archon_1",   star: "I" },
    { min: 2464, name: "Archon",   file: "archon_2",   star: "II" },
    { min: 2618, name: "Archon",   file: "archon_3",   star: "III" },
    { min: 2772, name: "Archon",   file: "archon_4",   star: "IV" },
    { min: 2926, name: "Archon",   file: "archon_5",   star: "V" },

    { min: 3080, name: "Legend",   file: "legend_1",   star: "I" },
    { min: 3234, name: "Legend",   file: "legend_2",   star: "II" },
    { min: 3388, name: "Legend",   file: "legend_3",   star: "III" },
    { min: 3542, name: "Legend",   file: "legend_4",   star: "IV" },
    { min: 3696, name: "Legend",   file: "legend_5",   star: "V" },

    { min: 3850, name: "Ancient",  file: "ancient_1",  star: "I" },
    { min: 4004, name: "Ancient",  file: "ancient_2",  star: "II" },
    { min: 4158, name: "Ancient",  file: "ancient_3",  star: "III" },
    { min: 4312, name: "Ancient",  file: "ancient_4",  star: "IV" },
    { min: 4466, name: "Ancient",  file: "ancient_5",  star: "V" },

    { min: 4620, name: "Divine",   file: "divine_1",   star: "I" },
    { min: 4820, name: "Divine",   file: "divine_2",   star: "II" },
    { min: 5020, name: "Divine",   file: "divine_3",   star: "III" },
    { min: 5220, name: "Divine",   file: "divine_4",   star: "IV" },
    { min: 5420, name: "Divine",   file: "divine_5",   star: "V" },

    { min: 5620, name: "Immortal", file: "immortal",   star: "" }
  ];
}

// =========================
// HEROES
// =========================

async function getHeroesMap() {
  const fm = FileManager.local();
  const cachePath = fm.joinPath(fm.documentsDirectory(), "dota_heroes_cache.json");

  try {
    const req = new Request("https://api.opendota.com/api/constants/heroes");
    req.headers = {
      "User-Agent": "DotaRankWidget"
    };

    const heroes = await req.loadJSON();
    fm.writeString(cachePath, JSON.stringify(heroes));

    return heroes;
  } catch (e) {
    if (fm.fileExists(cachePath)) {
      try {
        return JSON.parse(fm.readString(cachePath));
      } catch (parseError) {
        return {};
      }
    }

    return {};
  }
}

function getHeroName(heroId, heroes) {
  const h = heroes?.[String(heroId)] || heroes?.[heroId];

  if (!h) {
    return heroId ? `Hero ${heroId}` : "—";
  }

  return h.localized_name || h.name || `Hero ${heroId}`;
}

// =========================
// FETCH / UTIL
// =========================

async function safeFetchJson(url, fallback) {
  try {
    return await fetchJson(url);
  } catch (e) {
    return fallback;
  }
}

async function safeFetchImage(url, fallback) {
  try {
    return await fetchImage(url);
  } catch (e) {
    return fallback;
  }
}

async function fetchJson(url) {
  const req = new Request(url);
  req.headers = {
    "User-Agent": "DotaRankWidget"
  };

  return await req.loadJSON();
}

async function fetchImage(url) {
  const req = new Request(url);
  req.headers = {
    "User-Agent": "DotaRankWidget"
  };

  return await req.loadImage();
}

function getMatchResult(match) {
  if (!match) return "No match";

  const isRadiant = match.player_slot < 128;
  const won = isRadiant === match.radiant_win;

  return won ? "Win" : "Loss";
}

function formatTime(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");

  return `${h}:${m}`;
}

function buildError(w, e) {
  w.setPadding(16, 16, 16, 16);

  const title = w.addText("DotaRank");
  title.font = Font.boldSystemFont(18);
  title.textColor = TEXT;

  w.addSpacer(8);

  const error = w.addText(T.noData);
  error.font = Font.systemFont(13);
  error.textColor = MUTED;

  w.addSpacer(4);

  const hint = w.addText(String(e).slice(0, 120));
  hint.font = Font.systemFont(8);
  hint.textColor = SUBTLE;
  hint.textOpacity = 0.75;
  hint.lineLimit = 5;

  w.addSpacer();

  const version = w.addText(`v${DOTARANK_VERSION}`);
  version.font = Font.systemFont(8);
  version.textColor = SUBTLE;
  version.textOpacity = 0.55;
}
