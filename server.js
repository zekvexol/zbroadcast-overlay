const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHANGE_ME_NOW";

const publicPath = path.join(__dirname, "public");
const overlayAssetsRootPath = path.join(publicPath, "overlay-assets");

if (!fs.existsSync(overlayAssetsRootPath)) {
    fs.mkdirSync(overlayAssetsRootPath, { recursive: true });
}

if (ADMIN_PASSWORD === "CHANGE_ME_NOW") {
    console.warn('WARNING: Using default ADMIN_PASSWORD value "CHANGE_ME_NOW". Change this before public deployment.');
}

app.use("/overlay-assets", express.static(overlayAssetsRootPath));
app.use(express.static(publicPath));

function sanitizeRoomId(roomId) {
    if (typeof roomId !== "string") {
        return null;
    }

    const trimmed = roomId.trim();

    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) {
        return null;
    }

    return trimmed;
}

function getRoomAssetsPath(roomId) {
    return path.join(overlayAssetsRootPath, roomId);
}

function ensureRoomAssetsDirectory(roomId) {
    const roomAssetsPath = getRoomAssetsPath(roomId);

    if (!fs.existsSync(roomAssetsPath)) {
        fs.mkdirSync(roomAssetsPath, { recursive: true });
    }

    return roomAssetsPath;
}

function getRoomFilePaths(roomId) {
    const roomAssetsPath = ensureRoomAssetsDirectory(roomId);

    return {
        roomAssetsPath,
        overlayFilePath: path.join(roomAssetsPath, "overlay.png"),
        blueLogoFilePath: path.join(roomAssetsPath, "blue-logo.png"),
        orangeLogoFilePath: path.join(roomAssetsPath, "orange-logo.png")
    };
}

function getSeriesWinsRequired(seriesType) {
    switch (seriesType) {
        case "Bo1":
            return 1;
        case "Bo2":
            return 2;
        case "Bo3":
            return 2;
        case "Bo5":
            return 3;
        case "Bo7":
            return 4;
        default:
            return 3;
    }
}

function normalizeRosterArray(value, expectedLength) {
    const safeArray = Array.isArray(value) ? value : [];
    const result = [];

    for (let i = 0; i < expectedLength; i++) {
        const entry = safeArray[i];
        result.push(typeof entry === "string" ? entry : "");
    }

    return result;
}

function getDefaultState(roomId) {
    const { overlayFilePath, blueLogoFilePath, orangeLogoFilePath } = getRoomFilePaths(roomId);

    return {
        leagueName: "",
        weekRound: "",
        seriesInfo: "",
        blueName: "BLUE",
        orangeName: "ORANGE",

        blueRoster: ["", "", ""],
        blueSubs: ["", ""],
        orangeRoster: ["", "", ""],
        orangeSubs: ["", ""],

        blueScore: 0,
        orangeScore: 0,
        blueSeries: 0,
        orangeSeries: 0,
        seriesType: "Bo5",
        seriesWinsRequired: 3,
        overlayDelaySeconds: 0,

        timingDisplayRunning: false,
        timingDisplayStartEpochMs: 0,
        timingDisplayElapsedMs: 0,

        overlayImagePath: fs.existsSync(overlayFilePath)
            ? `/overlay-assets/${roomId}/overlay.png?v=${Date.now()}`
            : "",
        blueLogoPath: fs.existsSync(blueLogoFilePath)
            ? `/overlay-assets/${roomId}/blue-logo.png?v=${Date.now()}`
            : "",
        orangeLogoPath: fs.existsSync(orangeLogoFilePath)
            ? `/overlay-assets/${roomId}/orange-logo.png?v=${Date.now()}`
            : "",
        history: [],
        displayInfoVersion: 0,
        lastInstantDisplayInfoVersion: 0
    };
}

function cloneState(roomState) {
    return JSON.parse(JSON.stringify(roomState));
}

const rooms = {};

function getRoom(roomId) {
    const safeRoomId = sanitizeRoomId(roomId);

    if (!safeRoomId) {
        return null;
    }

    if (!rooms[safeRoomId]) {
        rooms[safeRoomId] = {
            state: getDefaultState(safeRoomId),
            undoStack: []
        };
    }

    return rooms[safeRoomId];
}

function pushUndoSnapshot(room) {
    room.undoStack.push(cloneState(room.state));

    if (room.undoStack.length > 100) {
        room.undoStack.shift();
    }
}

function broadcastRoomState(roomId) {
    const room = getRoom(roomId);

    if (!room) {
        return;
    }

    io.to(roomId).emit("stateUpdate", room.state);
}

function getCurrentGameNumber(roomState) {
    return roomState.blueSeries + roomState.orangeSeries + 1;
}

function buildFullOverlayStatePayload(roomState) {
    return {
        leagueName: roomState.leagueName,
        weekRound: roomState.weekRound,
        seriesInfo: roomState.seriesInfo,
        blueName: roomState.blueName,
        orangeName: roomState.orangeName,

        blueRoster: [...roomState.blueRoster],
        blueSubs: [...roomState.blueSubs],
        orangeRoster: [...roomState.orangeRoster],
        orangeSubs: [...roomState.orangeSubs],

        blueScore: roomState.blueScore,
        orangeScore: roomState.orangeScore,
        blueSeries: roomState.blueSeries,
        orangeSeries: roomState.orangeSeries,
        seriesType: roomState.seriesType,
        seriesWinsRequired: roomState.seriesWinsRequired,
        overlayDelaySeconds: roomState.overlayDelaySeconds,

        timingDisplayRunning: roomState.timingDisplayRunning,
        timingDisplayStartEpochMs: roomState.timingDisplayStartEpochMs,
        timingDisplayElapsedMs: roomState.timingDisplayElapsedMs,

        overlayImagePath: roomState.overlayImagePath,
        blueLogoPath: roomState.blueLogoPath,
        orangeLogoPath: roomState.orangeLogoPath,
        displayInfoVersion: roomState.displayInfoVersion,
        lastInstantDisplayInfoVersion: roomState.lastInstantDisplayInfoVersion
    };
}

function sanitizeDisplayInfoPayload(roomState, payload) {
    const nextSeriesType = typeof payload.seriesType === "string" ? payload.seriesType : roomState.seriesType;
    const allowedSeriesTypes = ["Bo1", "Bo2", "Bo3", "Bo5", "Bo7"];
    const safeSeriesType = allowedSeriesTypes.includes(nextSeriesType) ? nextSeriesType : roomState.seriesType;

    return {
        leagueName: typeof payload.leagueName === "string" ? payload.leagueName.toUpperCase() : roomState.leagueName,
        weekRound: typeof payload.weekRound === "string" ? payload.weekRound.toUpperCase() : roomState.weekRound,
        seriesInfo: typeof payload.seriesInfo === "string" ? payload.seriesInfo.toUpperCase() : roomState.seriesInfo,
        blueName: typeof payload.blueName === "string" && payload.blueName.trim() !== ""
            ? payload.blueName.toUpperCase()
            : roomState.blueName,
        orangeName: typeof payload.orangeName === "string" && payload.orangeName.trim() !== ""
            ? payload.orangeName.toUpperCase()
            : roomState.orangeName,
        seriesType: safeSeriesType,
        blueLogoPath: typeof payload.blueLogoPath === "string" ? payload.blueLogoPath : roomState.blueLogoPath,
        orangeLogoPath: typeof payload.orangeLogoPath === "string" ? payload.orangeLogoPath : roomState.orangeLogoPath,

        blueRoster: normalizeRosterArray(payload.blueRoster, 3).map(v => v.toUpperCase()),
        blueSubs: normalizeRosterArray(payload.blueSubs, 2).map(v => v.toUpperCase()),
        orangeRoster: normalizeRosterArray(payload.orangeRoster, 3).map(v => v.toUpperCase()),
        orangeSubs: normalizeRosterArray(payload.orangeSubs, 2).map(v => v.toUpperCase())
    };
}

function applyDisplayInfo(roomState, payload) {
    const sanitized = sanitizeDisplayInfoPayload(roomState, payload);

    roomState.leagueName = sanitized.leagueName;
    roomState.weekRound = sanitized.weekRound;
    roomState.seriesInfo = sanitized.seriesInfo;
    roomState.blueName = sanitized.blueName;
    roomState.orangeName = sanitized.orangeName;

    roomState.blueLogoPath = sanitized.blueLogoPath;
    roomState.orangeLogoPath = sanitized.orangeLogoPath;

    roomState.blueRoster = [...sanitized.blueRoster];
    roomState.blueSubs = [...sanitized.blueSubs];
    roomState.orangeRoster = [...sanitized.orangeRoster];
    roomState.orangeSubs = [...sanitized.orangeSubs];

    if (roomState.seriesType !== sanitized.seriesType) {
        roomState.seriesType = sanitized.seriesType;
        roomState.seriesWinsRequired = getSeriesWinsRequired(sanitized.seriesType);

        if (roomState.blueSeries > roomState.seriesWinsRequired) {
            roomState.blueSeries = roomState.seriesWinsRequired;
        }

        if (roomState.orangeSeries > roomState.seriesWinsRequired) {
            roomState.orangeSeries = roomState.seriesWinsRequired;
        }
    }

    roomState.displayInfoVersion += 1;
}

function pushGoalHistory(roomState, team) {
    const teamName = team === "blue" ? roomState.blueName : roomState.orangeName;

    roomState.history.push({
        type: "goal",
        team: team,
        text: `${teamName} Goal`,
        timestamp: Date.now()
    });
}

function pushFinalHistory(roomState, winnerTeam, blueScore, orangeScore, gameNumber) {
    const winnerName = winnerTeam === "blue" ? roomState.blueName : roomState.orangeName;

    roomState.history.push({
        type: "final",
        gameNumber: gameNumber,
        winnerTeam: winnerTeam,
        winnerName: winnerName,
        blueScore: blueScore,
        orangeScore: orangeScore,
        timestamp: Date.now()
    });
}

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024
    },
    fileFilter: function (req, file, cb) {
        if (file.mimetype === "image/png") {
            cb(null, true);
        } else {
            cb(new Error("Only PNG files are allowed."));
        }
    }
});

function runSingleUpload(req, res, fieldName, callback) {
    upload.single(fieldName)(req, res, function (err) {
        if (err) {
            return res.status(400).json({
                success: false,
                error: err.message || "Upload failed."
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                error: "No file uploaded."
            });
        }

        callback();
    });
}

function getValidatedRoomIdFromRequest(req, res) {
    const roomId = sanitizeRoomId(req.params.roomId);

    if (!roomId) {
        res.status(400).send("Invalid room ID.");
        return null;
    }

    return roomId;
}

app.get("/control.html", (req, res) => {
    res.redirect("/room/default-room/control");
});

app.get("/overlay.html", (req, res) => {
    res.redirect("/room/default-room/overlay");
});

app.get("/room/:roomId/control", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;
    getRoom(roomId);
    res.sendFile(path.join(publicPath, "control.html"));
});

app.get("/room/:roomId/overlay", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;
    getRoom(roomId);
    res.sendFile(path.join(publicPath, "overlay.html"));
});

app.post("/api/room/:roomId/upload-overlay", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    runSingleUpload(req, res, "overlayImage", () => {
        const room = getRoom(roomId);
        const { overlayFilePath } = getRoomFilePaths(roomId);

        fs.writeFileSync(overlayFilePath, req.file.buffer);

        room.state.overlayImagePath = `/overlay-assets/${roomId}/overlay.png?v=${Date.now()}`;
        broadcastRoomState(roomId);

        res.json({
            success: true,
            overlayImagePath: room.state.overlayImagePath
        });
    });
});

app.post("/api/room/:roomId/clear-overlay", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    const room = getRoom(roomId);
    const { overlayFilePath } = getRoomFilePaths(roomId);

    if (fs.existsSync(overlayFilePath)) {
        fs.unlinkSync(overlayFilePath);
    }

    room.state.overlayImagePath = "";
    broadcastRoomState(roomId);

    res.json({
        success: true,
        overlayImagePath: room.state.overlayImagePath
    });
});

app.post("/api/room/:roomId/upload-blue-logo", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    runSingleUpload(req, res, "blueLogo", () => {
        const { blueLogoFilePath } = getRoomFilePaths(roomId);

        fs.writeFileSync(blueLogoFilePath, req.file.buffer);

        res.json({
            success: true,
            blueLogoPath: `/overlay-assets/${roomId}/blue-logo.png?v=${Date.now()}`
        });
    });
});

app.post("/api/room/:roomId/clear-blue-logo", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    const { blueLogoFilePath } = getRoomFilePaths(roomId);

    if (fs.existsSync(blueLogoFilePath)) {
        fs.unlinkSync(blueLogoFilePath);
    }

    res.json({
        success: true,
        blueLogoPath: ""
    });
});

app.post("/api/room/:roomId/upload-orange-logo", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    runSingleUpload(req, res, "orangeLogo", () => {
        const { orangeLogoFilePath } = getRoomFilePaths(roomId);

        fs.writeFileSync(orangeLogoFilePath, req.file.buffer);

        res.json({
            success: true,
            orangeLogoPath: `/overlay-assets/${roomId}/orange-logo.png?v=${Date.now()}`
        });
    });
});

app.post("/api/room/:roomId/clear-orange-logo", (req, res) => {
    const roomId = getValidatedRoomIdFromRequest(req, res);
    if (!roomId) return;

    const { orangeLogoFilePath } = getRoomFilePaths(roomId);

    if (fs.existsSync(orangeLogoFilePath)) {
        fs.unlinkSync(orangeLogoFilePath);
    }

    res.json({
        success: true,
        orangeLogoPath: ""
    });
});

function getSocketRoom(socket) {
    const roomId = socket.data.roomId;
    if (!roomId) return null;

    const room = getRoom(roomId);
    if (!room) return null;

    return { roomId, room };
}

function isAdminSocket(socket) {
    return socket.data.role === "admin";
}

function ensureAdminSocket(socket) {
    return isAdminSocket(socket) && !!socket.data.roomId;
}

io.on("connection", (socket) => {
    console.log("Client connected");

    socket.on("joinRoom", (payload = {}) => {
        const roomId = sanitizeRoomId(payload.roomId);
        const role = payload.role === "admin" ? "admin" : "overlay";

        if (!roomId) {
            socket.emit("joinError", {
                code: "INVALID_ROOM",
                message: "Invalid room ID."
            });
            return;
        }

        if (role === "admin") {
            const adminKey = typeof payload.adminKey === "string" ? payload.adminKey : "";

            if (adminKey !== ADMIN_PASSWORD) {
                socket.emit("joinError", {
                    code: "BAD_ADMIN_PASSWORD",
                    message: "Incorrect admin password."
                });
                return;
            }
        }

        if (socket.data.roomId) {
            socket.leave(socket.data.roomId);
        }

        socket.join(roomId);
        socket.data.roomId = roomId;
        socket.data.role = role;

        const room = getRoom(roomId);

        socket.emit("joinAccepted", {
            roomId,
            role,
            state: room.state
        });

        console.log(`Socket joined room "${roomId}" as ${role}`);
    });

    socket.on("updateDisplayInfoQueued", (payload) => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        applyDisplayInfo(roomContext.room.state, payload);
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("updateDisplayInfoInstant", (payload) => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        applyDisplayInfo(roomContext.room.state, payload);
        roomContext.room.state.lastInstantDisplayInfoVersion = roomContext.room.state.displayInfoVersion;
        broadcastRoomState(roomContext.roomId);
        io.to(roomContext.roomId).emit("instantOverlayState", buildFullOverlayStatePayload(roomContext.room.state));
    });

    socket.on("blueGoal", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        roomContext.room.state.blueScore++;
        pushGoalHistory(roomContext.room.state, "blue");
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("orangeGoal", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        roomContext.room.state.orangeScore++;
        pushGoalHistory(roomContext.room.state, "orange");
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("undoBlueGoal", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.blueScore > 0) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.blueScore--;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("undoOrangeGoal", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.orangeScore > 0) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.orangeScore--;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("resetGame", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        roomContext.room.state.blueScore = 0;
        roomContext.room.state.orangeScore = 0;
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("blueSeriesWin", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.blueSeries < roomContext.room.state.seriesWinsRequired) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.blueSeries++;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("orangeSeriesWin", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.orangeSeries < roomContext.room.state.seriesWinsRequired) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.orangeSeries++;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("undoBlueSeries", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.blueSeries > 0) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.blueSeries--;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("undoOrangeSeries", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.state.orangeSeries > 0) {
            pushUndoSnapshot(roomContext.room);
            roomContext.room.state.orangeSeries--;
            broadcastRoomState(roomContext.roomId);
        }
    });

    socket.on("blueWins", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const roomState = roomContext.room.state;

        pushUndoSnapshot(roomContext.room);

        const finalBlueScore = roomState.blueScore;
        const finalOrangeScore = roomState.orangeScore;
        const finalGameNumber = getCurrentGameNumber(roomState);

        pushFinalHistory(roomState, "blue", finalBlueScore, finalOrangeScore, finalGameNumber);

        if (roomState.blueSeries < roomState.seriesWinsRequired) {
            roomState.blueSeries++;
        }

        roomState.blueScore = 0;
        roomState.orangeScore = 0;

        broadcastRoomState(roomContext.roomId);
    });

    socket.on("orangeWins", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const roomState = roomContext.room.state;

        pushUndoSnapshot(roomContext.room);

        const finalBlueScore = roomState.blueScore;
        const finalOrangeScore = roomState.orangeScore;
        const finalGameNumber = getCurrentGameNumber(roomState);

        pushFinalHistory(roomState, "orange", finalBlueScore, finalOrangeScore, finalGameNumber);

        if (roomState.orangeSeries < roomState.seriesWinsRequired) {
            roomState.orangeSeries++;
        }

        roomState.blueScore = 0;
        roomState.orangeScore = 0;

        broadcastRoomState(roomContext.roomId);
    });

    socket.on("setOverlayDelay", (delaySeconds) => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);

        const parsedDelay = parseInt(delaySeconds, 10);

        if (isNaN(parsedDelay) || parsedDelay < 0) {
            roomContext.room.state.overlayDelaySeconds = 0;
        } else {
            roomContext.room.state.overlayDelaySeconds = parsedDelay;
        }

        broadcastRoomState(roomContext.roomId);
    });

    socket.on("startTimingDisplay", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        roomContext.room.state.timingDisplayRunning = true;
        roomContext.room.state.timingDisplayStartEpochMs = Date.now();
        roomContext.room.state.timingDisplayElapsedMs = 0;
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("stopTimingDisplay", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const roomState = roomContext.room.state;

        pushUndoSnapshot(roomContext.room);

        if (roomState.timingDisplayRunning && roomState.timingDisplayStartEpochMs > 0) {
            roomState.timingDisplayElapsedMs = Date.now() - roomState.timingDisplayStartEpochMs;
        }

        roomState.timingDisplayRunning = false;
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("resetTimingDisplay", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        pushUndoSnapshot(roomContext.room);
        roomContext.room.state.timingDisplayRunning = false;
        roomContext.room.state.timingDisplayStartEpochMs = 0;
        roomContext.room.state.timingDisplayElapsedMs = 0;
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("resetSeries", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const roomState = roomContext.room.state;

        pushUndoSnapshot(roomContext.room);
        roomState.blueSeries = 0;
        roomState.orangeSeries = 0;
        roomState.blueScore = 0;
        roomState.orangeScore = 0;
        roomState.history = [];
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("swapTeams", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const roomState = roomContext.room.state;
        pushUndoSnapshot(roomContext.room);

        const oldBlueName = roomState.blueName;
        const oldBlueLogoPath = roomState.blueLogoPath;
        const oldBlueRoster = [...roomState.blueRoster];
        const oldBlueSubs = [...roomState.blueSubs];

        roomState.blueName = roomState.orangeName;
        roomState.blueLogoPath = roomState.orangeLogoPath;
        roomState.blueRoster = [...roomState.orangeRoster];
        roomState.blueSubs = [...roomState.orangeSubs];

        roomState.orangeName = oldBlueName;
        roomState.orangeLogoPath = oldBlueLogoPath;
        roomState.orangeRoster = [...oldBlueRoster];
        roomState.orangeSubs = [...oldBlueSubs];

        roomState.displayInfoVersion += 1;
        broadcastRoomState(roomContext.roomId);
    });

    socket.on("fullReset", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        const currentOverlayImagePath = roomContext.room.state.overlayImagePath;

        pushUndoSnapshot(roomContext.room);

        roomContext.room.state = getDefaultState(roomContext.roomId);
        roomContext.room.state.overlayImagePath = currentOverlayImagePath;
        roomContext.room.undoStack = roomContext.room.undoStack;

        broadcastRoomState(roomContext.roomId);
        io.to(roomContext.roomId).emit("overlayQueueReset", buildFullOverlayStatePayload(roomContext.room.state));
    });

    socket.on("undoLastAction", () => {
        if (!ensureAdminSocket(socket)) return;
        const roomContext = getSocketRoom(socket);
        if (!roomContext) return;

        if (roomContext.room.undoStack.length === 0) {
            return;
        }

        roomContext.room.state = roomContext.room.undoStack.pop();
        broadcastRoomState(roomContext.roomId);
        io.to(roomContext.roomId).emit("overlayQueueReset", buildFullOverlayStatePayload(roomContext.room.state));
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});