import socketHelpers from './socketHelpers';
import {
    checkFreeUsername,
    getRoomsData,
    getTopUsersTypedPercentList,
    updateRoomReadyList,
    updateUserInfo,
    rooms,
    users,
} from './storage';
import messageGenerator from './MessageGenerator';

export default (io) => {
    io.on('connection', (socket) => {
        const {
            getRoomClients,
            getCurrentRoomId,
            checkStatusFinishedGame,
            finishGame,
            joinToRoom,
            leaveFromRoom,
            readinessCheckAndSentStartGame,
        } = socketHelpers(io, socket);

        console.debug('getRoomClients', getRoomClients);
        const username = socket.handshake.query.username;
        if (!username) return;

        if (checkFreeUsername(username)) {
            updateUserInfo({ id: socket.id, newStatusData: { username } });
            io.to(socket.id).emit('UPDATE_LIST_ROOMS', getRoomsData());
        } else {
            socket.emit('CHANGE_USER_NAME', username);
            return;
        }

        socket.on('CREATE_ROOM', (roomId) => {
            if (rooms.has(roomId)) {
                socket.emit('ROOM_NAME_ALREADY_USE', roomId);
                return;
            }
            joinToRoom(roomId);
        });

        socket.on('GET_ME_CURRENT_TOP', (roomId, callback) => {
            const currentUsersListInRoom = getRoomClients(roomId);
            const usersTopList = getTopUsersTypedPercentList(currentUsersListInRoom);
            callback(messageGenerator.getCurrentLeadersList(usersTopList));
        });

        socket.on('JOIN_ROOM', (roomId) => joinToRoom(roomId));

        socket.on('LEAVE_ROOM', (roomId) => {
            leaveFromRoom(roomId);
        });

        socket.on('UPDATE_STATUS_READY', ({ status: isReadyToPlay, userId, roomId }) => {
            const currentUserId = socket.id;

            if (isReadyToPlay) {
                updateRoomReadyList(roomId, currentUserId);
            } else {
                updateRoomReadyList(roomId, currentUserId, false);
            }
            updateUserInfo({ id: currentUserId, newStatusData: { isReadyToPlay } });
            socket.broadcast.to(roomId).emit('UPDATE_STATUS_READY', users.get(userId));
            readinessCheckAndSentStartGame(roomId);
        });

        socket.on('TIMER_FINISHED', (roomId) => {
            finishGame(roomId);
        });

        socket.on('UPDATE_TYPED_PROGRESS', (updatedUser) => {
            const { id, isFinished } = updatedUser;
            updateUserInfo({ id, newStatusData: updatedUser });
            const currentRoomId = getCurrentRoomId();

            if (isFinished) {
                checkStatusFinishedGame(currentRoomId);
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
            const currentRoomId = getCurrentRoomId();
            leaveFromRoom(currentRoomId);
            users.delete(socket.id);
        });
    });
};
