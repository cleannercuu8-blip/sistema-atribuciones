const bcrypt = require('bcryptjs');
bcrypt.hash('Admin123!', 10).then(hash => {
    console.log('---HASH_START---');
    console.log(hash);
    console.log('---HASH_END---');
});
