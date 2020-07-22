const username = sessionStorage.getItem('username');
const $roomsPage = document.getElementById('rooms-page');
const $gamePage = document.getElementById('game-page');
const $createNewRoomBtn = document.getElementById('create-room');

if (!username) {
    window.location.replace('/login');
}

class RoomsList {
    constructor(socket) {
        this.$roomsContainer = document.getElementById('rooms');
        this.$roomsContainer.addEventListener('click', (e) => this.joinToRoom(e));

        this.socket = socket;
    }

    getRoomTemplate({ name, usersLength }) {
        return `<div class="card">
                <div class="card-body text-center">
                    <h6 class="card-subtitle mb-2 text-muted">${usersLength} user connected</h6>
                    <h2 class="card-title">${name}</h2>
                    <button class="btn btn-primary" data-action="start-game" data-room-id="${name}">Join</button>
                </div>
            </div>`;
    }

    getRoomsTemplate(rooms) {
        return rooms.reduce((roomsTemplate, room) => roomsTemplate + this.getRoomTemplate(room), '');
    }

    joinToRoom({ target }) {
        if (target.tagName === 'BUTTON') {
            const roomId = target.getAttribute('data-room-id');
            this.socket.emit('JOIN_ROOM', roomId);
        }
    }

    createNewRoom() {
        const roomName = prompt("Type room's name");
        if (roomName !== null) {
            if (roomName.trim().length) {
                this.socket.emit('CREATE_ROOM', roomName);
            } else {
                alert('Name can not be empty!');
                this.createNewRoom();
            }
        }
    }

    updateRoomList(rooms) {
        this.$roomsContainer.innerHTML = this.getRoomsTemplate(rooms);
    }
}

class TextWindow {
    constructor(socket, gameControl) {
        this.BLOCK_KEYS = ['Escape', 'Tab', 'Backspace', 'Enter'];
        this.gameControl = gameControl;
        this.socket = socket;

        this.counterTypedSymbols = null;
        this.counterTextSymbols = null;
        this.text = null;

        this.$textWindow = document.getElementById('text-window');
        this.$fronText = document.getElementById('text-front');
        this.$textBack = document.getElementById('text-back');

        this.handlerKeyDown = this.handlerKeyDown.bind(this);
    }

    getInputProgressPercent() {
        return ((100 * this.counterTypedSymbols) / this.counterTextSymbols).toFixed(3);
    }

    accentValidSymbol() {
        document.getElementById(`symbol-${this.counterTypedSymbols}`)?.classList.add('accent');
    }

    updateBackText() {
        const currentSymbol = document.getElementById(`symbol-${this.counterTypedSymbols}`);

        currentSymbol.removeAttribute('class');
        currentSymbol.nextElementSibling?.classList.add('helper');
    }

    handlerKeyDown(e) {
        const isBlockedKeys = this.BLOCK_KEYS.some((blockKey) => blockKey === e.key);

        if (isBlockedKeys) return;

        if (e.key === this.text[this.counterTypedSymbols]) {
            this.updateBackText();
            this.gameControl.updateUserProgress(this.socket.id, this.getInputProgressPercent());
            this.counterTypedSymbols++ === this.counterTextSymbols && this.removeKeyHandler();
        } else {
            this.accentValidSymbol();
        }
    }

    initKeyHandler() {
        window.addEventListener('keydown', this.handlerKeyDown);
    }

    removeKeyHandler() {
        window.removeEventListener('keydown', this.handlerKeyDown);
    }

    getTemplateSpanBackText(symbol, index) {
        const helperClass = index === 0 ? 'helper' : '';
        return `<span id="symbol-${index}" class="invisible ${helperClass}">${symbol}</span>`;
    }

    getSpanBlocksForFrontText(text) {
        return [...text].reduce((accumulator, symbol) => accumulator + `<span>${symbol}</span>`, '');
    }

    getSpanBlocksForBackText(text) {
        /* prettier-ignore */
        return [...text].reduce((accumulator, symbol, index) => accumulator + this.getTemplateSpanBackText(symbol, index), '');
    }

    show() {
        this.$textWindow.classList.remove('d-none');
    }

    hide() {
        this.$textWindow.classList.add('d-none');
        window.removeEventListener('keydown', this.handlerKeyDown);
    }

    init(text) {
        this.text = text;
        this.counterTypedSymbols = 0;
        this.counterTextSymbols = text.length - 1;
        this.$fronText.innerHTML = this.getSpanBlocksForFrontText(text);
        this.$textBack.innerHTML = this.getSpanBlocksForBackText(text);
        this.initKeyHandler();
    }
}

class Game {
    constructor(socket) {
        this.roomId = null;
        this.userId = null;
        this.socket = socket;
        this.secondForGame = 0;
        this.secondCounterAfterStartGame = 0;
        this.secondLeaderUpdateRate = 0;
        this.gameTimerId = null;

        this.controlTextWindow = new TextWindow(socket, this);

        this.$title = document.getElementById('room-title');
        this.$beforeGameTimer = document.getElementById('timer-counter');
        this.$gameTimer = document.getElementById('after-start-timer');
        this.$backToRoomsBtn = document.getElementById('back-to-rooms-list');
        this.$usersList = document.getElementById('users-list');
        this.$readyBtnsContaine = document.getElementById('ready-buttons');
        this.$readyBtn = document.getElementById('ready-btn');
        this.$notReadyBtn = document.getElementById('not-ready-btn');
    }

    updateUserProgress(userId, progress, updateCurrentUser = true) {
        const $userProgressWrp = document.getElementById(userId);
        $userProgressWrp.querySelector('.progress-bar').style.width = progress + '%';

        const sendData = { id: userId, progress };
        if (Math.floor(progress) === 100) {
            $userProgressWrp.classList.add('finished');
            sendData.isFinished = true;
            sendData.score = this.secondForGame - this.secondCounterAfterStartGame;
        }
        updateCurrentUser && socket.emit('UPDATE_TYPED_PROGRESS', sendData);
    }

    changeCurrentUserStatusReady(status) {
        this.socket.emit('UPDATE_STATUS_READY', {
            status,
            userId: this.userId,
            roomId: this.roomId,
        });

        this.$readyBtn.classList.toggle('d-none');
        this.$notReadyBtn.classList.toggle('d-none');
        document.getElementById(`ready-${this.userId}`).classList.toggle('ready');
    }

    getUserTemplate({ username, isReadyToPlay, id, isFinished, progress }) {
        const readyClass = isReadyToPlay ? 'ready' : '';
        const finishedClass = isFinished ? 'finished' : '';
        let isCurrentUser = false;

        if (id === this.userId) {
            isCurrentUser = true;
        }

        return `<li id="${id}" class="list-group-item p-2 ${finishedClass}" >
                    <div  id="ready-${id}" class="ready-status mb-1 ${readyClass}">
                        <small class="m-0">${username} ${isCurrentUser ? '(you)' : ''}</small>
                    </div>
                    <div class="progress">
                        <div id="progress-${id}" style="width: ${progress}%" class="progress-bar progress-bar-striped progress-bar-animated" role="progressbar"></div>
                    </div>
                </li>`;
    }

    resetGameTemplate() {
        this.$gameTimer.classList.add('d-none');
        this.controlTextWindow.hide();
        this.$readyBtnsContaine.classList.remove('d-none');
        this.$notReadyBtn.classList.add('d-none');
        this.$readyBtn.classList.remove('d-none');
        this.$backToRoomsBtn.classList.remove('invisible');
    }

    backToRoomsList() {
        $gamePage.classList.add('d-none');
        $roomsPage.classList.remove('d-none');
        this.socket.emit('LEAVE_ROOM', this.roomId);
    }

    stopGame(usersList) {
        gameControl.updateUsersList(usersList);
        clearInterval(this.gameTimerId);
        this.resetGameTemplate();
    }

    updateUsersList(usersList) {
        this.$usersList.innerHTML = usersList.reduce(
            (previous, current) => previous + this.getUserTemplate(current),
            ''
        );
    }

    updateUserStatus({ id, isReadyToPlay }) {
        const $changingUser = document.getElementById(`ready-${id}`);
        if (isReadyToPlay) {
            $changingUser.classList.add('ready');
        } else {
            $changingUser.classList.remove('ready');
        }
    }

    updateBeforeGameTimerTemplate(count) {
        this.$beforeGameTimer.innerHTML = `<p class="timer-before-game__count">${count}</p>`;
    }

    updateLasLeadersList(count) {
        if (!(count % this.secondLeaderUpdateRate) && count !== this.secondForGame) {
            this.socket.emit('GET_ME_CURRENT_TOP', this.roomId, (message) => {
                commentatorControl.newComment(message);
            });
        }
    }

    updateGameTimerTemplate(count) {
        this.secondCounterAfterStartGame = count;
        this.$gameTimer.innerHTML = count + ' second left';
    }

    updateDataFromGameTimer(count) {
        this.updateLasLeadersList(count);
        this.updateGameTimerTemplate(count);
    }

    initTimer(duration, updateTimerClb) {
        return new Promise((resolve) => {
            let count = duration;
            updateTimerClb(count);
            count--;
            const intervalId = setInterval(() => {
                updateTimerClb(count);
                if (count === 0) {
                    resolve();
                    return clearInterval(intervalId);
                }
                count--;
            }, 1000);
            this.gameTimerId = intervalId;
        });
    }

    async loadTextForGame(textIndex) {
        const response = await fetch(`/api/get-text/${textIndex}`);
        if (!response.ok) {
            alert('Ooops... Error receiving text');
        }
        this.controlTextWindow.init(await response.json());
    }

    async startGame({ secondBeforeStartGame, secondForGame, secondLeaderUpdateRate, textId }) {
        this.secondForGame = secondForGame;
        this.secondLeaderUpdateRate = secondLeaderUpdateRate;
        this.$backToRoomsBtn.classList.add('invisible');
        this.$readyBtnsContaine.classList.add('d-none');
        this.$beforeGameTimer.classList.remove('d-none');
        this.loadTextForGame(textId);
        await this.initTimer(secondBeforeStartGame, (count) => this.updateBeforeGameTimerTemplate(count));

        setTimeout(async () => {
            this.controlTextWindow.show();
            this.$beforeGameTimer.classList.add('d-none');
            this.$gameTimer.classList.remove('d-none');
            await this.initTimer(secondForGame, (count) => this.updateDataFromGameTimer(count));

            socket.emit('TIMER_FINISHED', this.roomId, (users) => {
                this.stopGame(users);
            });
        }, 1000); //NOTE: сss before game timer animation compensation
    }

    removeBtnEventListener() {
        this.$readyBtn.removeEventListener('click', () => this.changeCurrentUserStatusReady(true));
        this.$notReadyBtn.removeEventListener('click', () => this.changeCurrentUserStatusReady(false));
        this.$backToRoomsBtn.removeEventListener('click', () => this.backToRoomsList());
    }

    initGameRoom({ users, roomName, currentUserId }) {
        this.$title.innerText = roomName;
        this.roomId = roomName;
        this.userId = currentUserId;
        this.updateUsersList(users);

        this.removeBtnEventListener();
        this.$readyBtn.addEventListener('click', () => this.changeCurrentUserStatusReady(true));
        this.$notReadyBtn.addEventListener('click', () => this.changeCurrentUserStatusReady(false));
        this.$backToRoomsBtn.addEventListener('click', () => this.backToRoomsList());

        $roomsPage.classList.add('d-none');
        $gamePage.classList.remove('d-none');
    }
}

class Commentator {
    constructor() {
        this.MSECOND_DURATION_SHOW_COMMENT = 15000;
        this.$commentator = document.getElementById('commentator');
        this.idTimer = null;
    }

    getMessageTemplate(message) {
        return `<div class="card commentator__message">
                    <div class="card-body">${message}</div>
                </div>`;
    }

    showComment(comment) {
        this.$commentator.innerHTML = this.getMessageTemplate(comment);
        this.$commentator.classList.remove('d-none');

        this.idTimer = setTimeout(() => this.hideComment(), this.MSECOND_DURATION_SHOW_COMMENT);
    }

    hideComment() {
        this.$commentator.classList.add('d-none');
    }

    newComment(comment) {
        clearTimeout(this.idTimer);
        this.showComment(comment);
    }
}

const socket = io('', { query: { username } });

socket.on('NAME_ALREADY_IN_USE', (username) => {
    alert(`Name: "${username}" already use`);
    sessionStorage.removeItem('username');
    window.location.replace('/login');
});

socket.on('ROOM_JOIN_DONE', ({ commentatorMessage, ...roomData }) => {
    commentatorControl.newComment(commentatorMessage);
    gameControl.initGameRoom(roomData);
});

socket.on('COMMENTATOR_MESSAGE', (message) => {
    commentatorControl.newComment(message);
});

socket.on('START_GAME', ({ commentatorMessage, ...roomData }) => {
    commentatorControl.newComment(commentatorMessage);
    gameControl.startGame(roomData);
});

socket.on('FINISH_GAME', (users, commentatorMessage) => {
    gameControl.stopGame(users);
    commentatorControl.newComment(commentatorMessage);
});

socket.on('GAME_UPDATE_USERS_LIST', (clients) => {
    gameControl.updateUsersList(clients);
});

socket.on('UPDATE_STATUS_READY', (user) => {
    gameControl.updateUserStatus(user);
});

socket.on('UPDATE_TYPED_PROGRESS', ({ id, progress }) => {
    gameControl.updateUserProgress(id, progress, false);
});

socket.on('ROOM_NAME_ALREADY_USE', (name) => {
    alert(`Name: "${name}" already use`);
    roomsListControl.createNewRoom();
});

socket.on('UPDATE_LIST_ROOMS', (data) => {
    roomsListControl.updateRoomList(data);
});

const roomsListControl = new RoomsList(socket, $roomsPage);
const gameControl = new Game(socket, roomsListControl);
const commentatorControl = new Commentator();

$createNewRoomBtn.addEventListener('click', () => roomsListControl.createNewRoom());
