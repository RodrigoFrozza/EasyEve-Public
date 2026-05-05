import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GROUP_TO_MARKET_GROUP: Record<number, number> = {
  // Copying from route.ts
  53: 88, 55: 87, 74: 86, 54: 10, 464: 10, 483: 10, 330: 675, 72: 141,
  506: 140, 507: 140, 508: 140, 509: 140, 510: 140, 511: 140, 512: 140, 524: 140, 1245: 140, 1673: 140, 1674: 140, 862: 140,
  38: 551, 39: 126, 40: 552, 41: 128, 77: 553, 57: 553, 295: 550, 338: 552,
  43: 665, 61: 664, 76: 668,
  201: 677, 202: 685, 203: 681, 208: 679, 65: 683, 80: 678, 379: 757,
  82: 672, 96: 670, 210: 669, 211: 707, 212: 671, 213: 706,
  46: 542,
  325: 537, 585: 538,
  67: 663, 68: 662, 71: 661, 289: 685, 290: 673, 291: 680, 321: 657,
  62: 134, 63: 538, 328: 553, 329: 133, 98: 133, 326: 134,
  60: 135,
  59: 646, 205: 647, 302: 648, 367: 645,
  78: 133, 285: 676, 315: 135,
  767: 667, 768: 666, 769: 658, 770: 554, 766: 658,
  762: 132, 763: 132, 764: 132, 765: 132,
  644: 135, 645: 135, 646: 135,
  546: 135,
  56: 87, 75: 86, 84: 87, 1287: 140, 1288: 140, 1289: 140, 1290: 140, 1302: 140, 1303: 140, 1304: 140, 1305: 140,
  21: 552, 27: 551, 28: 551, 1001: 553, 1002: 553,
  310: 134, 311: 134, 312: 134, 313: 134,
  1205: 542, 1206: 542,
  404: 677, 408: 683, 410: 681, 428: 678,
  222: 671, 217: 706, 1541: 668, 1542: 668, 1543: 668,
  772: 939, 773: 939, 774: 939, 775: 939, 776: 939, 777: 939, 778: 939,
  100: 135, 102: 135, 104: 135, 106: 135,
  220: 10, 221: 10,
  331: 675,
}

async function main() {
  const modules = await prisma.moduleStats.findMany({
    where: {
      slotType: { not: null },
      OR: [
        { categoryId: null },
        { categoryId: { not: 8 } }
      ]
    },
    select: {
      groupId: true,
      groupName: true,
      typeId: true,
      name: true
    }
  })

  const unmapped = new Map<number, string>()
  const mapped = new Set<number>()

  for (const mod of modules) {
    if (!mod.groupId) continue
    if (GROUP_TO_MARKET_GROUP[mod.groupId]) {
      mapped.add(mod.groupId)
    } else {
      unmapped.set(mod.groupId, mod.groupName || 'Unknown')
    }
  }

  console.log('Unmapped Groups:')
  for (const [id, name] of unmapped.entries()) {
    console.log(`${id}: ${name}`)
  }
}

main()
