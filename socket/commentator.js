class MessageGenerator {
    getParticipantsList(usersList) {
        return usersList.reduce(
            (prevValue, currentValue) => `${prevValue} \n ${currentValue.username}`,
            'А тем временем, список гонщиков: '
        );
    }

    getCurrentLeadersList(usersList) {
        const MAX_LEADERS_IN_MESSAGE = 3;
        const PARTS_OF_THE_PHRASES = [
            '*username* сейчас на первом месте',
            ',за ним идёт *username*',
            ',a третьим идёт *username*',
        ];

        let message = '';

        for (let i = 0; i < MAX_LEADERS_IN_MESSAGE; i++) {
            const currentUser = usersList[i];

            if (!currentUser) {
                break;
            }

            message += PARTS_OF_THE_PHRASES[i].replace('*username*', usersList[i]);
        }

        return message;
    }
}

export default new Commentator();
