db.getCollection('users').createIndex({
    email: 1
});
db.getCollection('users').createIndex({
    name: 1
});
db.getCollection('users').createIndex({
    resetPasswordToken: 1
});
db.getCollection('users').createIndex({
    sessions.id: 1
});
db.getCollection('files').createIndex({
    user: 1
});
db.getCollection('files').createIndex({
    user: 1,
    path: 1
});
db.getCollection('jobs').createIndex({
    user: 1
});
db.getCollection('jobs').createIndex({
    status: 1
});
