// vue.config.js
module.exports = {
  publicPath: '',
  configureWebpack: {
    externals: {
      'vue-chartjs':'Vuejscharts'
    },
  },
  css: undefined,
  pages: undefined,
  devServer: {
    port: 3000,
  },
  productionSourceMap: false,
};
