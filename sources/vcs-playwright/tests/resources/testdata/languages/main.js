function helloWorld() {
  return 'Hello, World from JavaScript!';
}

function calculateSum(a, b) {
  return a + b;
}

class Calculator {
  constructor() {
    this.history = [];
  }

  add(a, b) {
    const result = a + b;
    this.history.push(`${a} + ${b} = ${result}`);
    return result;
  }

  getHistory() {
    return this.history;
  }
}

console.log(helloWorld());

const calc = new Calculator();
const result = calc.add(30, 40);
console.log(`Sum: ${result}`);
console.log('History:', calc.getHistory());

module.exports = { helloWorld, calculateSum, Calculator };
