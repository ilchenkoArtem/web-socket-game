import {
    SECONDS_TIMER_BEFORE_START_GAME,
    SECONDS_FOR_GAME,
    MINIMUM_USERS_FOR_START_GAME,
    SECOND_LEADER_UPDATE_RATE,
} from './config';
import { getRandomInt } from '../helper';
import { texts } from '../data';
import {
    getRoomsData,
    updateRoomCountUsers,
    updateRoomReadyList,
    updateRoomsInfo,
    updateUserInfo,
    rooms,
    users,
    getTopUsersScoreList,
} from './storage';
import messageGenerator from './messageGenerator';

export const readinessCheckAndSentStartGame = (io, roomId) => {
    const { usersCount, usersReady, isStarted } = rooms.get(roomId);

    if (usersCount >= MINIMUM_USERS_FOR_START_GAME && usersCount === usersReady.size && !isStarted) {
        updateRoomsInfo(roomId, { isStarted: true, isFinishedGame: false, usersReady: new Set() });

        const usersInCurrentRoom = getRoomClients(io, roomId);
        io.in(roomId).emit('START_GAME', {
            secondBeforeStartGame: SECONDS_TIMER_BEFORE_START_GAME,
            secondForGame: SECONDS_FOR_GAME,
            secondLeaderUpdateRate: SECOND_LEADER_UPDATE_RATE,
            textId: getRandomInt(0, texts.length),
            users: usersInCurrentRoom,
            commentatorMessage: messageGenerator.getUserNameList(usersInCurrentRoom),
        });

        sentUpdateListRoom(io);
    }
};

export const sentUpdateGameUsersList = (io, socket, currentRoomId) => {
    socket.broadcast.to(currentRoomId).emit('GAME_UPDATE_USERS_LIST', getRoomClients(io, currentRoomId));
};

export const getCurrentRoomId = (socket) => Object.keys(socket.rooms).find((roomId) => rooms.has(roomId));

export const getRoomClients = (io, roomId) => {
    let roomsUsers = [];
    try {
        roomsUsers = Object.keys(io.sockets?.adapter?.rooms[roomId]?.sockets);
    } catch (e) {}

    const usersList = [];

    users.forEach((user) => {
        roomsUsers.some((roomUser) => roomUser === user.id) && usersList.push(user);
    });
    return usersList;
};

const getCurrentUser = (socket) => users.get(socket.id);

export const joinToRoom = ({ roomId, io, socket }) => {
    const prevRoomId = getCurrentRoomId(socket);
    if (prevRoomId === roomId) {
        return;
    }

    if (prevRoomId) {
        socket.leave(prevRoomId);
    }

    socket.join(roomId, () => {
        updateRoomsInfo(roomId);
        updateRoomCountUsers(roomId, 1);
        sentUpdateListRoom(io, socket);
        io.to(socket.id).emit('ROOM_JOIN_DONE', {
            users: getRoomClients(io, roomId),
            roomName: roomId,
            currentUserId: socket.id,
            commentatorMessage: messageGenerator.getHelloMessage(),
        });

        socket.broadcast
            .to(roomId)
            .emit('COMMENTATOR_MESSAGE', messageGenerator.getJoinNewUser(getCurrentUser(socket).username));
        sentUpdateGameUsersList(io, socket, roomId);
    });
};

export const sentUpdateListRoom = (io) => {
    io.emit('UPDATE_LIST_ROOMS', getRoomsData(io));
};

export const resetUsersInfoAfterGame = (io, roomId) => {
    const users = getRoomClients(io, roomId);
    users.forEach(({ id }) => {
        updateUserInfo({ id, isNew: true });
    });
};

export const finishGame = (io, roomId) => {
    const users = getRoomClients(io, roomId);
    const { isFinishedGame } = rooms.get(roomId);

    if (!isFinishedGame) {
        updateRoomsInfo(roomId, { isFinishedGame: true, isStarted: false });
        resetUsersInfoAfterGame(io, roomId);

        const topUsersList = getTopUsersScoreList(users.filter((user) => user.isFinished && user.score));
        io.to(roomId).emit(
            'FINISH_GAME',
            getRoomClients(io, roomId),
            messageGenerator.getFinishGameMessage(topUsersList)
        );

        sentUpdateListRoom(io);
    }
};

export const checkStatusFinishedGame = (io, roomId) => {
    const users = getRoomClients(io, roomId);
    if (users.every((user) => user.isFinished)) {
        finishGame(io, roomId);
    }
};

export const leaveFromRoom = (io, socket, roomId) => {
    if (roomId) {
        updateRoomCountUsers(roomId, -1);
        updateRoomReadyList(roomId, socket.id, false);
        socket.leave(roomId);
        readinessCheckAndSentStartGame(io, roomId);
        sentUpdateGameUsersList(io, socket, roomId);
    }

    rooms.forEach(({ id: roomId, usersCount }) => {
        if (!usersCount) {
            rooms.delete(roomId);
        }
    });
    sentUpdateListRoom(io, socket);
};
