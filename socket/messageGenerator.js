import { getRandomInt } from '../helper';

class MessageGenerator {
    getHelloMessage() {
        return `На улице сейчас немного пасмурно, но на Арене сейчас просто замечательная атмосфера: кнопки прогреваются, зрители улыбаются а участники едва заметно нервничают и готовят своих железных коней к заезду. А комментировать всё это действо буду я, Эскейп Энтерович и я рад вас приветствовать со словами Доброго Вам дня, господа!`;
    }

    replaceTemplateToValue(string, value) {
        const USER_NAME_TEMPLATE = '*username*';
        return string.replace(USER_NAME_TEMPLATE, value);
    }

    getJoinNewUser(username) {
        const MESSAGE_TEMPLATE_LIST = [
            'У нас пополнение! Приветствуем нового учасника *username*',
            'Воу воу, к нам присоеденился тот самый *username*',
            'Молодая звезда *username* теперь с нами!',
        ];
        const message = MESSAGE_TEMPLATE_LIST[getRandomInt(0, MESSAGE_TEMPLATE_LIST.length)];

        return this.replaceTemplateToValue(message, username);
    }

    getUsersList(usersList, startString = '', template = () => '') {
        return usersList.reduce(
            (prevValue, currentValue, index) => prevValue + template(currentValue, index),
            startString
        );
    }

    getUsersNameListItem(user, index) {
        /*prettier-ignore*/
        return `<div class="d-flex justify-content-between border-bottom"><span><b class="mr-1">#${++index}:</b> ${user.username}</span></div>`;
    }

    getUsersListItemWithScore(user, index) {
        /*prettier-ignore*/
        return `<div class="d-flex justify-content-between border-bottom"><span><b class="mr-1">#${++index}:</b> ${user.username}</span> <b>${user.score} second</b></div>`;
    }

    getUserNameList(usersList) {
        return this.getUsersList(
            usersList,
            'Игра вот-вот начнётся! А тем временем, список гонщиков: ',
            this.getUsersNameListItem
        );
    }

    getCurrentLeadersList(usersList) {
        const PARTS_OF_THE_PHRASES = [
            '*username* сейчас на первом месте',
            ', за ним идёт *username*',
            ', a третьим идёт *username*',
        ];

        let message = '';

        for (let i = 0; i < usersList.length; i++) {
            const currentUserName = usersList[i]?.username;

            if (!currentUserName) {
                break;
            }
            message += this.replaceTemplateToValue(PARTS_OF_THE_PHRASES[i], currentUserName);
        }

        return message;
    }

    getUserFinished(userName) {
        return `Финишную черту пересекает ${userName}`;
    }

    finishGamesMessageWithoutUsers() {
        return 'Дааам, такого не ожидал никто! Ниодин игрок не успел пересечь финишную черту.';
    }

    finishGameMessageWithUsers(usersTop) {
        const FIRST_MESSAGE_PART = 'Подошло к концу это пальцесшебательное противостояние и таковы результаты: ';

        return this.getUsersList(usersTop, FIRST_MESSAGE_PART, this.getUsersListItemWithScore);
    }

    getFinishGameMessage(usersTop) {
        return usersTop.length ? this.finishGameMessageWithUsers(usersTop) : this.finishGamesMessageWithoutUsers();
    }
}

export default new MessageGenerator();
