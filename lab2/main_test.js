const test = require('node:test');
const assert = require('assert');
const fs = require('fs');
test.mock.method(fs, 'readFile', (path, encoding, callback) => {
    callback(null, 'A\nB\nC');
});

const { Application, MailSystem } = require('./main');

test('MailSystem.write correctly formats the message', async (t) => {
    const mailSystem = new MailSystem();

    const messageA = mailSystem.write('A');
    const messageB = mailSystem.write('B');

    assert.strictEqual(messageA, 'Congrats, A!', 'The message for A should be correct');
    assert.strictEqual(messageB, 'Congrats, B!', 'The message for B should be correct');
});

test('MailSystem.send should return success or failure based on random value', async (t) => {
    const mailSystem = new MailSystem();

    // Test success case with a random value > 0.5
    t.mock.method(Math, 'random', () => 0.75);
    const resultA = mailSystem.send('A', 'Congrats, A!');
    assert.strictEqual(resultA, true, 'Mail for A should be sent successfully');

    // Test failure case with a random value <= 0.5
    t.mock.method(Math, 'random', () => 0.25);
    const resultB = mailSystem.send('B', 'Congrats, B!');
    assert.strictEqual(resultB, false, 'Mail for B should fail');
});

async function createApplication() {
    const app = new Application();
    // Wait for the promise in the constructor to resolve
    await new Promise(resolve => {
        const checkIfLoaded = () => {
            if (app.people.length > 0) {
                resolve();
            } else {
                setTimeout(checkIfLoaded, 10);
            }
        };
        checkIfLoaded();
    });
    return app;
}

test('Application.getNames loads the people and selected arrays correctly', async (t) => {
    const app = await createApplication();

    const [people, selected] = await app.getNames();

    assert.deepStrictEqual(people, ['A', 'B', 'C'], 'People array should contain A, B, C');
    assert.deepStrictEqual(selected, [], 'Initially, no one should be selected');
});

test('Application.getRandomPerson selects a random person from the people list', async (t) => {
    const app = await createApplication();

    const person = app.getRandomPerson();
    assert(person === 'A' || person === 'B' || person === 'C', 'The selected person should be from A, B, or C');
});

test('Application.selectNextPerson selects three unique people', async (t) => {
    // 建立 Application 實例
    const application = await createApplication();

    // 先將 'A' 加入 selected 陣列
    application.selected = ['A'];

    // 模擬 getRandomPerson 方法，確保選擇順序為 'A' -> 'B' -> 'C'
    let callCount = 0;
    t.mock.method(application, 'getRandomPerson', () => {
        callCount++;
        return callCount === 1 ? 'A' : callCount === 2 ? 'B' : 'C';
    });

    // 第一次選擇，應該略過 'A'，選擇 'B'
    const result1 = application.selectNextPerson();
    assert.strictEqual(result1, 'B');
    assert.deepStrictEqual(application.selected, ['A', 'B']);

    // 第二次選擇，應該略過 'A' 和 'B'，選擇 'C'
    const result2 = application.selectNextPerson();
    assert.strictEqual(result2, 'C');
    assert.deepStrictEqual(application.selected, ['A', 'B', 'C']);

    // 第三次應該沒有可選的人，應該回傳 null
    const result3 = application.selectNextPerson();
    assert.strictEqual(result3, null, 'No more people should be selectable');

    // 確保 getRandomPerson 總共被呼叫三次
    assert.strictEqual(callCount, 3, 'getRandomPerson should be called three times');
});

test('Application.notifySelected calls mailSystem methods for each selected person', async (t) => {
    // Verify these methods are called for each selected person
    const application = await createApplication();
    application.selected = ['A', 'B', 'C']; // Set selected people

    // Create spies for mailSystem methods
    const writeSpy = t.mock.method(application.mailSystem, 'write');
    const sendSpy = t.mock.method(application.mailSystem, 'send');

    // Execute the method being tested
    application.notifySelected();

    // Verify write was called for each selected person
    assert.strictEqual(writeSpy.mock.calls.length, 3);
    assert.deepStrictEqual(writeSpy.mock.calls[0].arguments, ['A']);
    assert.deepStrictEqual(writeSpy.mock.calls[1].arguments, ['B']);
    assert.deepStrictEqual(writeSpy.mock.calls[2].arguments, ['C']);

    // Verify send was called for each selected person
    assert.strictEqual(sendSpy.mock.calls.length, 3);
    assert.deepStrictEqual(sendSpy.mock.calls[0].arguments[0], 'A');
    assert.deepStrictEqual(sendSpy.mock.calls[1].arguments[0], 'B');
    assert.deepStrictEqual(sendSpy.mock.calls[2].arguments[0], 'C');
});