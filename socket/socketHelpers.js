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
    getTopUsersList,
} from './storage';
import messageGenerator from './messageGenerator';

function socketHelpers(io, socket) {
    const readinessCheckAndSentStartGame = (roomId) => {
        const { usersCount, usersReady, isStarted } = rooms.get(roomId);

        if (usersCount >= MINIMUM_USERS_FOR_START_GAME && usersCount === usersReady.size && !isStarted) {
            updateRoomsInfo(roomId, { isStarted: true, isFinishedGame: false, usersReady: new Set() });

            const usersInCurrentRoom = getRoomClients(roomId);
            io.in(roomId).emit('START_GAME', {
                secondBeforeStartGame: SECONDS_TIMER_BEFORE_START_GAME,
                secondForGame: SECONDS_FOR_GAME,
                secondLeaderUpdateRate: SECOND_LEADER_UPDATE_RATE,
                textId: getRandomInt(0, texts.length),
                users: usersInCurrentRoom,
                commentatorMessage: messageGenerator.getUserNameList(usersInCurrentRoom),
            });

            sentUpdateListRoom();
        }
    };

    const sentUpdateGameUsersList = (currentRoomId) => {
        socket.broadcast.to(currentRoomId).emit('GAME_UPDATE_USERS_LIST', getRoomClients(currentRoomId));
    };

    const getCurrentRoomId = () => Object.keys(socket.rooms).find((roomId) => rooms.has(roomId));

    const getRoomClients = (roomId) => {
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

    const getCurrentUser = () => users.get(socket.id);

    const joinToRoom = (roomId) => {
        const prevRoomId = getCurrentRoomId();
        if (prevRoomId === roomId) {
            return;
        }

        if (prevRoomId) {
            socket.leave(prevRoomId);
        }

        socket.join(roomId, () => {
            updateRoomsInfo(roomId);
            updateRoomCountUsers(roomId, 1);
            sentUpdateListRoom();
            io.to(socket.id).emit('ROOM_JOIN_DONE', {
                users: getRoomClients(roomId),
                roomName: roomId,
                currentUserId: socket.id,
                commentatorMessage: messageGenerator.getHelloMessage(),
            });

            socket.broadcast
                .to(roomId)
                .emit('COMMENTATOR_MESSAGE', messageGenerator.getJoinNewUser(getCurrentUser().username));
            sentUpdateGameUsersList(roomId);
        });
    };

    const sentUpdateListRoom = () => {
        io.emit('UPDATE_LIST_ROOMS', getRoomsData());
    };

    const resetUsersInfoAfterGame = (roomId) => {
        const users = getRoomClients(roomId);
        users.forEach(({ id }) => {
            updateUserInfo({ id, isNew: true });
        });
    };

    const finishGame = (roomId) => {
        const users = getRoomClients(roomId);
        const { isFinishedGame } = rooms.get(roomId);

        if (!isFinishedGame) {
            updateRoomsInfo(roomId, { isFinishedGame: true, isStarted: false });
            resetUsersInfoAfterGame(roomId);

            const topUsersList = getTopUsersList(
                users.filter((user) => user.isFinished && user.score),
                'score'
            );
            io.to(roomId).emit(
                'FINISH_GAME',
                getRoomClients(roomId),
                messageGenerator.getFinishGameMessage(topUsersList)
            );

            sentUpdateListRoom();
        }
    };

    const checkStatusFinishedGame = (roomId) => {
        const users = getRoomClients(roomId);
        if (users.every((user) => user.isFinished)) {
            finishGame(roomId);
        }
    };

    const leaveFromRoom = (roomId) => {
        if (roomId) {
            updateRoomCountUsers(roomId, -1);
            updateRoomReadyList(roomId, socket.id, false);
            socket.leave(roomId);
            readinessCheckAndSentStartGame(roomId);
            sentUpdateGameUsersList(roomId);
        }

        rooms.forEach(({ id: roomId, usersCount }) => {
            if (!usersCount) {
                rooms.delete(roomId);
            }
        });
        sentUpdateListRoom();
    };

    return {
        readinessCheckAndSentStartGame,
        sentUpdateGameUsersList,
        getCurrentRoomId,
        getRoomClients,
        getCurrentUser,
        joinToRoom,
        sentUpdateListRoom,
        resetUsersInfoAfterGame,
        finishGame,
        checkStatusFinishedGame,
        leaveFromRoom,
    };
}

export default socketHelpers;
