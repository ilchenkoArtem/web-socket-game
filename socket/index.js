import {
    checkStatusFinishedGame,
    finishGame,
    getCurrentRoomId,
    getRoomClients,
    joinToRoom,
    leaveFromRoom,
    readinessCheckAndSentStartGame,
} from './socketHelpers';
import {
    checkFreeUsername,
    getRoomsData,
    getTopUsersScoreList,
    getTopUsersTypedPercentList,
    rooms,
    updateRoomReadyList,
    updateUserInfo,
    users,
} from './storage';
import MessageGenerator from './MessageGenerator';
import messageGenerator from './MessageGenerator';

export default (io) => {
    io.on('connection', (socket) => {
        const username = socket.handshake.query.username;
        if (!username) return;

        if (checkFreeUsername(username)) {
            updateUserInfo({ id: socket.id, newStatusData: { username } });
            io.to(socket.id).emit('UPDATE_LIST_ROOMS', getRoomsData(io));
        } else {
            socket.emit('CHANGE_USER_NAME', username);
            return;
        }

        socket.on('CREATE_ROOM', (roomId) => {
            if (rooms.has(roomId)) {
                socket.emit('ROOM_NAME_ALREADY_USE', roomId);
                return;
            }
            joinToRoom({ roomId, socket, io });
        });

        socket.on('GET_ME_CURRENT_TOP', (roomId, callback) => {
            const currentUsersListInRoom = getRoomClients(io, roomId);
            const usersTopList = getTopUsersTypedPercentList(currentUsersListInRoom);
            callback(messageGenerator.getCurrentLeadersList(usersTopList));
        });

        socket.on('JOIN_ROOM', (roomId) => {
            joinToRoom({ roomId, socket, io });
        });

        socket.on('LEAVE_ROOM', (roomId) => {
            leaveFromRoom(io, socket, roomId);
        });

        socket.on('UPDATE_STATUS_READY', ({ status: isReadyToPlay, userId, roomId }) => {
            if (isReadyToPlay) {
                updateRoomReadyList(roomId, socket.id);
            } else {
                updateRoomReadyList(roomId, socket.id, false);
            }
            updateUserInfo({ id: socket.id, newStatusData: { isReadyToPlay } });
            socket.broadcast.to(roomId).emit('UPDATE_STATUS_READY', users.get(userId));
            readinessCheckAndSentStartGame(io, roomId);
        });

        socket.on('TIMER_FINISHED', (roomId) => {
            finishGame(io, roomId);
        });

        socket.on('UPDATE_TYPED_PROGRESS', (updatedUser) => {
            const { id, isFinished } = updatedUser;
            updateUserInfo({ id, newStatusData: updatedUser });
            const currentRoomId = getCurrentRoomId(socket);

            if (isFinished) {
                checkStatusFinishedGame(io, currentRoomId);
                socket.broadcast
                    .to(currentRoomId)
                    .emit(
                        'COMMENTATOR_MESSAGE',
                        messageGenerator.getUserFinished(users.get(id).username ?? 'Неизвестаная личность')
                    );
            }

            const { isFinishedGame } = rooms.get(currentRoomId);

            if (!isFinishedGame) {
                socket.broadcast.to(currentRoomId).emit('UPDATE_TYPED_PROGRESS', updatedUser);
            }
        });

        socket.on('disconnecting', function () {
            const currentRoomId = getCurrentRoomId(socket);
            leaveFromRoom(io, socket, currentRoomId);
            users.delete(socket.id);
        });
    });
};
