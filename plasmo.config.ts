export default {
  manifest: {
    name: 'BeamIt',
    description: '抓取网页视频流并投屏到电视',
    host_permissions: ['http://192.168.*/*', 'http://10.*/*'],
    permissions: ['storage', 'activeTab']
  }
};
