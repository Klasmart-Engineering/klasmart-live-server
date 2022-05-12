export const  getUniqueId = () => {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
        const r = Math.random()*16|0, v = c == "x" ? r : (r&0x3|0x8);
        return v.toString(16);
    });
};

export const getRandomNumber = (limit = 1000) => {
    return Math.floor((Math.random() * limit));
};

export const getRandomBoolean = () => {
    return Boolean(getRandomNumber(2));
};

export const getRandomFeedbackType = () => {
    const candidates = ["END_CLASS", "LEAVE_CLASS"];
    const x = getRandomNumber(2);
    return candidates[x];
};

export const getRandomQuickFeedbackType  = () => {
    const candidates = ["VIDEO", "AUDIO", "PRESENTATION", "OTHER"];
    const x = getRandomNumber(4);
    return candidates[x];
};

export const getEpochTime = (expire: number) => {
    const date = new Date();
    date.setMinutes(date.getMinutes() + expire); 
    return Math.floor(date.getTime()/1000);
};

export const getRandomString = (size = 1) => {
    const candidates = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    let ret = "";
    for (let i = 0; i <= size; i++) {
        const j = getRandomNumber(candidates.length);
        ret += candidates[j];
    }
    return ret;
};

export const wait = async (time: number): Promise<void> => {
    return new Promise((resolve, reject) => {
        setTimeout(()=> {
            resolve();
        }, time);
    });
    
};