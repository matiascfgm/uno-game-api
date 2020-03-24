module.exports = function (app) {
  app.get('/checkStatus', async (req, res) => {

    res.json({'message': 'it works!'});
  });
};
