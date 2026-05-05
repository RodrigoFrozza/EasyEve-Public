import os from 'os'

console.log('Platform:', os.platform())
console.log('Arch:', os.arch())
console.log('CPUs:', os.cpus().length)
console.log('Total Mem:', (os.totalmem() / 1024 / 1024 / 1024).toFixed(2), 'GB')
console.log('Free Mem:', (os.freemem() / 1024 / 1024 / 1024).toFixed(2), 'GB')
console.log('Uptime:', (os.uptime() / 3600).toFixed(2), 'hours')
console.log('Load Avg:', os.loadavg())
