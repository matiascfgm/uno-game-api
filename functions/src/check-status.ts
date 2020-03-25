// @ts-ignore
module.exports = function (app) {
  // @ts-ignore
  app.get('/checkStatus', async (req, res) => {

    res.json({'message': 'it works!'});
  });
};
