// DotaRankWidget.js
// Remote core file for DotaRank Widget.
// Do not edit user settings here. User settings are passed from Loader.

const DOTARANK_VERSION = "1.0.0";

const USER_CONFIG = globalThis.DOTARANK_CONFIG || {};

const ACCOUNT_ID = String(USER_CONFIG.accountId || "1643456704");
const START_PTS = Number(USER_CONFIG.startPts ?? 2169);

const RESET_PTS = Boolean(USER_CONFIG.resetPts || false);
const RESET_ICON_STYLE = Boolean(USER_CONFIG.resetIconStyle || false);

const PTS_WIN = Number(USER_CONFIG.ptsWin ?? 25);
const PTS_LOSS = Number(USER_CONFIG.ptsLoss ?? 25);

const TRACK_RANKED_ONLY = USER_CONFIG.trackRankedOnly !== false;

const PREVIEW_SIZE = USER_CONFIG.previewSize || "small";

const GITHUB_RAW_BASE =
  USER_CONFIG.githubRawBase ||
  "https://raw.githubusercontent.com/Floca1488/Dota-Rank-Widget/main/icons";

// =========================
// COLORS
// =========================

const BG_TOP = new Color("#09090B");
const BG_BOTTOM = new Color("#201126");

const CARD_STRONG = new Color("#FFFFFF", 0.13);
const CARD_SOFT = new Color("#FFFFFF", 0.075);

const TEXT = Color.white();
const MUTED = new Color("#C7C7D1");
const SUBTLE = new Color("#9B9BA7");
const ACCENT = new Color("#D8B4FE");

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
Script.complete();

if (!config.runsInWidget) {
  if (PREVIEW_SIZE === "large") {
    await widget.presentLarge();
  } else if (PREVIEW_SIZE === "medium") {
    await widget.presentMedium();
  } else {
    await widget.presentSmall();
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

  const player = await fetchJson(`https://api.opendota.com/api/players/${ACCOUNT_ID}`);
  const recent = await fetchJson(`https://api.opendota.com/api/players/${ACCOUNT_ID}/recentMatches`);

  const name = player?.profile?.personaname || "Dota Player";
  const avatarUrl = player?.profile?.avatarfull || player?.profile?.avatarmedium || null;
  const avatar = avatarUrl ? await fetchImage(avatarUrl) : null;

  const matches = Array.isArray(recent) ? recent : [];
  const displayMatch = matches.length > 0 ? matches[0] : null;

  const lastResult = displayMatch ? getMatchResult(displayMatch) : "No match";
  const kda = displayMatch ? `${displayMatch.kills}/${displayMatch.deaths}/${displayMatch.assists}` : "—";

  const ptsData = updatePtsFromMatches(matches);
  const pts = ptsData.pts;

  const rankData = getRankByPts(pts);
  const rankImage = await loadRankImage(rankData.fileName, iconStyle);

  return {
    name,
    avatar,
    lastResult,
    kda,
    pts,
    ptsChangeText: ptsData.changeText,
    rankTitle: rankData.title,
    rankFileName: rankData.fileName,
    rankImage,
    iconStyle,
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
  alert.title = "DotaRank Widget";
  alert.message = "Choose rank icon style";
  alert.addAction("Default");
  alert.addAction("Umbrella");

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
  if (RESET_PTS || !Keychain.contains(STORAGE_KEY_PTS)) {
    Keychain.set(STORAGE_KEY_PTS, String(START_PTS));

    const latestRanked = getLatestTrackedMatch(matches);
    if (latestRanked?.match_id) {
      Keychain.set(STORAGE_KEY_MATCH, String(latestRanked.match_id));
    }

    return {
      pts: START_PTS,
      changed: false,
      changeText: ""
    };
  }

  let pts = Number(Keychain.get(STORAGE_KEY_PTS));
  if (isNaN(pts)) pts = START_PTS;

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
    m => String(m.match_id) === savedMatchId
  );

  let newMatches = [];

  if (savedIndex === -1) {
    newMatches = [trackedMatches[0]];
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
    changeText: totalChange > 0 ? `+${totalChange}` : `${totalChange}`
  };
}

function getLatestTrackedMatch(matches) {
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
    avatarSize: 26,
    gameFont: 8,
    nameFont: 13
  });

  w.addSpacer(7);

  const card = w.addStack();
  card.layoutVertically();
  card.backgroundColor = CARD_STRONG;
  card.cornerRadius = 15;
  card.setPadding(7, 9, 8, 9);

  addSectionLabel(card, "RANK", 8);
  card.addSpacer(3);

  const rankRow = card.addStack();
  rankRow.layoutHorizontally();
  rankRow.centerAlignContent();

  if (data.rankImage) {
    const icon = rankRow.addImage(data.rankImage);
    icon.imageSize = new Size(42, 42);
    rankRow.addSpacer(7);
  }

  const rankText = rankRow.addText(data.rankTitle);
  rankText.font = Font.boldSystemFont(14);
  rankText.textColor = TEXT;
  rankText.lineLimit = 1;
  rankText.minimumScaleFactor = 0.55;

  card.addSpacer(5);

  const pts = card.addText(getPtsLine(data, false));
  pts.font = Font.boldSystemFont(15);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.75;

  w.addSpacer();

  const bottom = w.addStack();
  bottom.layoutHorizontally();
  bottom.centerAlignContent();

  const result = bottom.addText(getShortResult(data.lastResult));
  result.font = Font.boldSystemFont(15);
  result.textColor = getResultColor(data.lastResult);

  bottom.addSpacer(7);

  const kda = bottom.addText(`KDA ${data.kda}`);
  kda.font = Font.mediumSystemFont(10);
  kda.textColor = MUTED;
  kda.lineLimit = 1;
  kda.minimumScaleFactor = 0.7;

  w.addSpacer(1);

  const updated = w.addText(data.updated);
  updated.font = Font.systemFont(8);
  updated.textColor = SUBTLE;
  updated.textOpacity = 0.6;
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

  w.addSpacer(10);

  const content = w.addStack();
  content.layoutHorizontally();
  content.topAlignContent();

  const rankCard = content.addStack();
  rankCard.layoutVertically();
  rankCard.backgroundColor = CARD_STRONG;
  rankCard.cornerRadius = 18;
  rankCard.setPadding(10, 11, 10, 11);
  rankCard.size = new Size(205, 0);

  addSectionLabel(rankCard, "RANK", 9);
  rankCard.addSpacer(5);

  const rankRow = rankCard.addStack();
  rankRow.layoutHorizontally();
  rankRow.centerAlignContent();

  if (data.rankImage) {
    const rankImg = rankRow.addImage(data.rankImage);
    rankImg.imageSize = new Size(58, 58);
    rankRow.addSpacer(10);
  }

  const rankName = rankRow.addText(data.rankTitle);
  rankName.font = Font.boldSystemFont(18);
  rankName.textColor = TEXT;
  rankName.lineLimit = 1;
  rankName.minimumScaleFactor = 0.55;

  rankCard.addSpacer(8);

  const pts = rankCard.addText(getPtsLine(data, true));
  pts.font = Font.boldSystemFont(20);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.75;

  content.addSpacer(10);

  const matchCard = content.addStack();
  matchCard.layoutVertically();
  matchCard.backgroundColor = CARD_SOFT;
  matchCard.cornerRadius = 18;
  matchCard.setPadding(10, 11, 10, 11);
  matchCard.size = new Size(105, 0);

  addSectionLabel(matchCard, "LAST", 9);
  matchCard.addSpacer(7);

  const result = matchCard.addText(getShortResult(data.lastResult));
  result.font = Font.boldSystemFont(28);
  result.textColor = getResultColor(data.lastResult);
  result.lineLimit = 1;

  matchCard.addSpacer(4);

  const kdaLabel = matchCard.addText("KDA");
  kdaLabel.font = Font.mediumSystemFont(8);
  kdaLabel.textColor = SUBTLE;
  kdaLabel.textOpacity = 0.85;

  const kda = matchCard.addText(data.kda);
  kda.font = Font.boldSystemFont(14);
  kda.textColor = TEXT;
  kda.lineLimit = 1;
  kda.minimumScaleFactor = 0.65;

  matchCard.addSpacer();

  const upd = matchCard.addText(data.updated);
  upd.font = Font.systemFont(8);
  upd.textColor = SUBTLE;
  upd.textOpacity = 0.65;
}

// =========================
// LARGE
// =========================

async function buildLarge(w, data) {
  w.setPadding(16, 16, 15, 16);

  addHeader(w, data, {
    avatarSize: 36,
    gameFont: 9,
    nameFont: 21
  });

  w.addSpacer(15);

  const rankCard = w.addStack();
  rankCard.layoutVertically();
  rankCard.backgroundColor = CARD_STRONG;
  rankCard.cornerRadius = 23;
  rankCard.setPadding(15, 16, 15, 16);

  addSectionLabel(rankCard, "CURRENT RANK", 10);
  rankCard.addSpacer(8);

  const rankRow = rankCard.addStack();
  rankRow.layoutHorizontally();
  rankRow.centerAlignContent();

  if (data.rankImage) {
    const rankImg = rankRow.addImage(data.rankImage);
    rankImg.imageSize = new Size(82, 82);
    rankRow.addSpacer(15);
  }

  const rankInfo = rankRow.addStack();
  rankInfo.layoutVertically();

  const rank = rankInfo.addText(data.rankTitle);
  rank.font = Font.boldSystemFont(27);
  rank.textColor = TEXT;
  rank.lineLimit = 1;
  rank.minimumScaleFactor = 0.65;

  rankInfo.addSpacer(8);

  const pts = rankInfo.addText(getPtsLine(data, true));
  pts.font = Font.boldSystemFont(29);
  pts.textColor = TEXT;
  pts.lineLimit = 1;
  pts.minimumScaleFactor = 0.7;

  w.addSpacer(14);

  const matchCard = w.addStack();
  matchCard.layoutVertically();
  matchCard.backgroundColor = CARD_SOFT;
  matchCard.cornerRadius = 22;
  matchCard.setPadding(13, 15, 13, 15);

  addSectionLabel(matchCard, "LAST MATCH", 10);
  matchCard.addSpacer(9);

  const matchRow = matchCard.addStack();
  matchRow.layoutHorizontally();
  matchRow.centerAlignContent();

  const result = matchRow.addText(getShortResult(data.lastResult));
  result.font = Font.boldSystemFont(32);
  result.textColor = getResultColor(data.lastResult);

  matchRow.addSpacer(14);

  const kda = matchRow.addText(`KDA ${data.kda}`);
  kda.font = Font.boldSystemFont(21);
  kda.textColor = TEXT;
  kda.lineLimit = 1;
  kda.minimumScaleFactor = 0.7;

  w.addSpacer();

  const footer = w.addStack();
  footer.layoutHorizontally();

  const updated = footer.addText(`Updated ${data.updated}`);
  updated.font = Font.systemFont(10);
  updated.textColor = SUBTLE;
  updated.textOpacity = 0.7;

  footer.addSpacer();

  const source = footer.addText(`${data.iconStyle} · v${DOTARANK_VERSION}`);
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

function getPtsLine(data, includeDelta) {
  if (includeDelta && data.ptsChangeText) {
    return `ПТС ${data.pts} ${data.ptsChangeText}`;
  }
  return `ПТС ${data.pts}`;
}

// =========================
// RANKS BY PTS
// =========================

function getRankByPts(pts) {
  const ranks = [
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
    title,
    fileName: current.file
  };
}

// =========================
// FETCH / UTIL
// =========================

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

  const error = w.addText("No data");
  error.font = Font.systemFont(13);
  error.textColor = MUTED;

  w.addSpacer(4);

  const hint = w.addText(String(e).slice(0, 90));
  hint.font = Font.systemFont(8);
  hint.textColor = SUBTLE;
  hint.textOpacity = 0.75;
}
