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
        console.log('currentSymbol', currentSymbol);
        currentSymbol.removeAttribute('class');
        currentSymbol.nextElementSibling?.classList.add('helper');
    }

    handlerKeyDown(e) {
        console.log(e);
        if (this.BLOCK_KEYS.some((blockKey) => blockKey === e.key)) return;

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

class Modal {
    constructor(controlGame) {
        this.$resultModal = document.getElementById('result');
        this.$finishedList = document.getElementById('result-finished-list');
        this.$closeBtn = document.getElementById('close-modal');

        this.controlGame = controlGame;

        this.init();
    }

    getTemplateFinishedUser({ username, score }, index) {
        return `<p class="d-flex justify-content-between border-bottom">
                    <b>#${index}</b> <span>${username}</span> <b>${score}s</b>
                </p>`;
    }

    getEmptyResult() {
        return `<img src="/img/snail.svg" class="d-block m-auto" width=150 height="150"/>`;
    }

    innerUsersListResult(users) {
        this.$finishedList.innerHTML = users?.length
            ? users.reduce(
                  (previous, current, index) => previous + this.getTemplateFinishedUser(current, index + 1),
                  ''
              )
            : this.getEmptyResult();
    }

    hide() {
        this.$resultModal.classList.remove('d-block');
        this.controlGame.resetGameButtons();
    }

    show(listFinishedUsers) {
        this.innerUsersListResult(listFinishedUsers);
        this.$resultModal.classList.add('d-block');
    }

    init() {
        this.$closeBtn.addEventListener('click', () => this.hide());
    }
}

class Game {
    constructor(socket) {
        this.roomId = null;
        this.userId = null;
        this.socket = socket;
        this.secondForGame = 0;
        this.secondCounterAfterStartGame = 0;
        this.gameTimerId = null;

        this.controlTextWindow = new TextWindow(socket, this);
        this.controlResultModal = new Modal(this);

        this.$title = document.getElementById('room-title');
        this.$beforGameTimer = document.getElementById('timer-counter');
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

    resetGameButtons() {
        this.$readyBtnsContaine.classList.remove('d-none');
        this.$notReadyBtn.classList.add('d-none');
        this.$readyBtn.classList.remove('d-none');
        this.$backToRoomsBtn.classList.remove('invisible');
    }

    resetGameTemplate() {
        this.$gameTimer.classList.add('d-none');
        this.controlTextWindow.hide();
    }

    backToRoomsList() {
        $gamePage.classList.add('d-none');
        $roomsPage.classList.remove('d-none');
        this.socket.emit('LEAVE_ROOM', this.roomId);
    }

    stopGame(users) {
        const topUsers = users.sort((UserA, UserB) => {
            if (UserA.score < UserB.score) {
                return -1;
            }
            if (UserA.score > UserB.score) {
                return 1;
            }
            return 0;
        });
        clearInterval(this.gameTimerId);
        this.resetGameTemplate();
        this.controlResultModal.show(topUsers);
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
        this.$beforGameTimer.innerHTML = `<p class="timer-before-game__count">${count}</p>`;
    }

    updateGameTimerTemplate(count) {
        this.secondCounterAfterStartGame = count;
        this.$gameTimer.innerHTML = count + ' second left';
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
            console.error(response.status);
            alert('Ooops... Error receiving text');
        }
        this.controlTextWindow.init(await response.json());
    }

    async startGame({ secondBeforeStartGame, secondForGame, textId }) {
        this.secondForGame = secondForGame;
        this.$backToRoomsBtn.classList.add('invisible');
        this.$readyBtnsContaine.classList.add('d-none');
        this.$beforGameTimer.classList.remove('d-none');
        this.loadTextForGame(textId);
        await this.initTimer(secondBeforeStartGame, (count) => this.updateBeforeGameTimerTemplate(count));

        setTimeout(async () => {
            this.controlTextWindow.show();
            this.$beforGameTimer.classList.add('d-none');
            this.$gameTimer.classList.remove('d-none');
            await this.initTimer(secondForGame, (count) => this.updateGameTimerTemplate(count));

            socket.emit('TIMER_FINISHED', this.roomId, (users) => {
                console.log('users', users);
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
    constructor(props) {
        this.MSECOND_DURATION_SHOW_COMMENT = 15000;
        this.$commentator = document.getElementById('commentator');
        this.idTimer = null;
    }

    showComment() {
        this.$commentator.classList.remove('d-none');

        this.idTimer = setTimeout(() => this.hideComment(), this.MSECOND_DURATION_SHOW_COMMENT);
    }

    hideComment() {
        this.$commentator.classList.add('d-none');
    }

    newComment(comment) {
        clearTimeout(this.idTimer);
        this.$commentator.innerHTML = comment;
    }
}

const socket = io('', { query: { username } });

socket.on('CHANGE_USER_NAME', (username) => {
    alert(`Name: "${username}" already use`);
    sessionStorage.removeItem('username');
    window.location.replace('/login');
});

socket.on('ROOM_JOIN_DONE', (clients) => {
    gameControl.initGameRoom(clients);
});

socket.on('START_GAME', (data) => {
    const { users } = data;
    console.log('users', users);
    gameControl.startGame(data);
});

socket.on('FINISH_GAME', (finishedUsers, restedUsersList) => {
    gameControl.updateUsersList(restedUsersList);
    gameControl.stopGame(finishedUsers);
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

$createNewRoomBtn.addEventListener('click', () => roomsListControl.createNewRoom());
