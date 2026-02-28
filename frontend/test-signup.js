const { CognitoUserPool, CognitoUserAttribute } = require('amazon-cognito-identity-js');

const poolData = {
    UserPoolId: 'ap-south-1_YkvAmWJfC',
    ClientId: '3pi3304ng9e5kuqloirqodmthd'
};

const userPool = new CognitoUserPool(poolData);

const attributeList = [
    new CognitoUserAttribute({ Name: 'name', Value: 'Test User' })
];

console.log("Attempting signup...");

userPool.signUp('test_new_user@example.com', 'Password123!', attributeList, null, (err, result) => {
    if (err) {
        console.error("Signup Failed:", err);
        return;
    }
    console.log("Signup Success:", result);
});
