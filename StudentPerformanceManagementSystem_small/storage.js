const storage = {
  users: [],
  tasks: [],
  connectedToMongo: false,
  setConnected(value) {
    this.connectedToMongo = value;
  },
  reset() {
    this.users = [];
    this.tasks = [];
  },
};

module.exports = storage;
