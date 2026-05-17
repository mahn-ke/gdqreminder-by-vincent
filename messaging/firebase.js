import { getMessaging } from 'firebase-admin/messaging';

export default class Firebase {
    #logger = null;
    constructor(logger)
    {
        this.#logger = logger;
    }
    sendRunStartNotification(run, reason) {
        const topic = `run.start.${run.id}`;

        const firebaseMessage = {
            notification: {
                title: `GDQ Reminder: ${run.name}`,
                body: "Live now! Tap and head to Twitch!"
            },
            android: {
                notification: {
                    color: "#00aeef",
                    icon: 'notification'
                }
            },
            data: {
                event: topic
            },
            topic: topic
        };

        let logData = {firebaseMessage, id: run.id, name: run.name, reason};

        this.#logger.info("[FIREBASE] Sending start message for run {id} ({name})... (Reason: {reason})", logData);
        getMessaging().send(firebaseMessage)
            .then((response) => {
                this.#logger.info("[FIREBASE] Successfully sent message for run {id} ({name}): {response} (Reason: {reason})", {...logData, response});
            })
            .catch((error) => {
                this.#logger.error("[FIREBASE] Error sending message for run {id} ({name}): {error}", {...logData, error});
            });
    }
    sendRunAddedNotification(run) {
        const topic = `event.announcement`;

        const now = new Date();
        const startTime = new Date(run.start);
        const diffMs = startTime - now;
        const diffHours = Math.max(0, Math.round(diffMs / (1000 * 60 * 60)));

        const firebaseMessage = {
            notification: {
                title: `New GDQ run added: ${run.display_name}!`,
                body: `Starting in ${diffHours} hour${diffHours !== 1 ? 's' : ''} - set a reminder now!`
            },
            android: {
                notification: {
                    color: "#00aeef",
                    icon: 'notification'
                }
            },
            data: {
                event: topic,
                pk: run.id.toString(),
            },
            topic: topic
        };

        let logData = {firebaseMessage, id: run.id, display_name: run.display_name};

        this.#logger.info("[FIREBASE] Sending run announcement for run {id} ({display_name})...", logData);
        getMessaging().send(firebaseMessage)
            .then((response) => {
                this.#logger.info("[FIREBASE] Successfully sent message for run {id} ({display_name})", {...logData, response});
            })
            .catch((error) => {
                this.#logger.error("[FIREBASE] Error sending message for run {id} ({display_name}): {error}", {...logData, error});
            });
    }
    sendEventAnnouncementNotification(event) {
        const topic = `event.update`;

        const firebaseMessage = {
            notification: {
                title: `New GDQ event announced: ${event.short.toUpperCase()}!`,
                body: "Tap to set your reminders!"
            },
            android: {
                notification: {
                    color: "#00aeef",
                    icon: 'notification'
                }
            },
            data: {
                event: topic,
                short: event.short
            },
            topic: topic
        };

        let logData = {firebaseMessage, event};

        this.#logger.info("[FIREBASE] Sending message for event {event.short}", logData);
        getMessaging().send(firebaseMessage)
            .then((response) => {
                this.#logger.info("[FIREBASE] Successfully sent message for event {event.short} (Response: {response})", {...logData, response});
            })
            .catch((error) => {
                this.#logger.error("[FIREBASE] Error sending message for event {event.short} (Error: {error})", {...logData, error});
            });
    }
}
