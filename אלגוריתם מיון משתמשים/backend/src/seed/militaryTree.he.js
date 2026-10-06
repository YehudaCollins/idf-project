const ROOT_PATH = 'מפקדת חיל היבשה (דמו)';
const MILITARY_ORG_TREE = {
    name: ROOT_PATH,
    type: 'מפקדה',
    isVerified: true,
    children: [
        {
            name: 'אגף התקשוב',
            type: 'אגף',
            isVerified: true,
            aliases: [{ value: 'אגף התקשבות', confidence: 0.91 }],
            children: [
                {
                    name: 'ענף צפון',
                    type: 'ענף',
                    isVerified: true,
                    children: [
                        {
                            name: 'מדור תומר',
                            type: 'מדור',
                            isVerified: true,
                            aliases: [{ value: 'מדור תמר', confidence: 0.9 }],
                            children: [
                                { name: 'צוות א׳', type: 'צוות', isVerified: true },
                                { name: 'צוות ב׳', type: 'צוות', isVerified: true },
                            ],
                        },
                    ],
                },
            ],
        },
        {
            name: 'אגף הלוגיסטיקה',
            type: 'אגף',
            isVerified: true,
            children: [
                {
                    name: 'ענף אספקה',
                    type: 'ענף',
                    isVerified: true,
                    children: [
                        { name: 'מדור מחסנים צפון', type: 'מדור', isVerified: true },
                    ],
                },
            ],
        },
        {
            name: 'אגף המודיעין',
            type: 'אגף',
            isVerified: true,
            children: [
                {
                    name: 'ענף ניתוח',
                    type: 'ענף',
                    isVerified: true,
                    children: [
                        { name: 'מדור שולחן א׳', type: 'מדור', isVerified: true },
                    ],
                },
            ],
        },
    ],
};

module.exports = { ROOT_PATH, MILITARY_ORG_TREE };
