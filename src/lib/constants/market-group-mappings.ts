/**
 * Market Group Structure and Mappings
 * Extracted from /api/modules/market-groups/route.ts
 */

export const MARKET_GROUP_STRUCTURE: Record<number, { name: string; description?: string; parentId: number | null }> = {
  // Root: Ship Equipment
  9: { name: 'Ship Equipment', parentId: null },
  
  // Ship Equipment Subcategories
  2815: { name: 'Compressors', parentId: 9 },
  938: { name: 'Drone Upgrades', parentId: 9 },
  657: { name: 'Electronic Warfare', parentId: 9 },
  656: { name: 'Electronics and Sensor Upgrades', parentId: 9 },
  655: { name: 'Engineering Equipment', parentId: 9 },
  779: { name: 'Fleet Assistance Modules', parentId: 9 },
  1713: { name: 'Harvest Equipment', parentId: 9 },
  14: { name: 'Hull & Armor', parentId: 9 },
  52: { name: 'Propulsion', parentId: 9 },
  1708: { name: 'Scanning Equipment', parentId: 9 },
  44: { name: 'Shield', parentId: 9 },
  141: { name: 'Smartbombs', parentId: 9 },
  1819: { name: 'Tactical Destroyer Modes', parentId: 9 },
  10: { name: 'Turrets & Launchers', parentId: 9 },
  
  // Turrets & Launchers - Subcategories for Splits
  380: { name: 'Micro Smartbombs', parentId: 141 },
  381: { name: 'Large Smartbombs', parentId: 141 },
  382: { name: 'Small Smartbombs', parentId: 141 },
  383: { name: 'Medium Smartbombs', parentId: 141 },

  // Turrets & Launchers (10)
  88: { name: 'Energy Turrets', parentId: 10 },
  557: { name: 'Beam Lasers', parentId: 88 },
  561: { name: 'Small Beam Lasers', parentId: 557 },
  562: { name: 'Medium Beam Lasers', parentId: 557 },
  563: { name: 'Large Beam Lasers', parentId: 557 },
  564: { name: 'XL Beam Lasers', parentId: 557 },
  558: { name: 'Pulse Lasers', parentId: 88 },
  565: { name: 'Small Pulse Lasers', parentId: 558 },
  566: { name: 'Medium Pulse Lasers', parentId: 558 },
  567: { name: 'Large Pulse Lasers', parentId: 558 },
  568: { name: 'XL Pulse Lasers', parentId: 558 },
  
  86: { name: 'Hybrid Turrets', parentId: 10 },
  555: { name: 'Railguns', parentId: 86 },
  573: { name: 'Small Railguns', parentId: 555 },
  574: { name: 'Medium Railguns', parentId: 555 },
  575: { name: 'Large Railguns', parentId: 555 },
  576: { name: 'XL Railguns', parentId: 555 },
  556: { name: 'Blasters', parentId: 86 },
  569: { name: 'Small Blasters', parentId: 556 },
  570: { name: 'Medium Blasters', parentId: 556 },
  571: { name: 'Large Blasters', parentId: 556 },
  572: { name: 'XL Blasters', parentId: 556 },
  
  87: { name: 'Projectile Turrets', parentId: 10 },
  559: { name: 'Autocannons', parentId: 87 },
  577: { name: 'Small Autocannons', parentId: 559 },
  578: { name: 'Medium Autocannons', parentId: 559 },
  579: { name: 'Large Autocannons', parentId: 559 },
  580: { name: 'XL Autocannons', parentId: 559 },
  560: { name: 'Artillery Cannons', parentId: 87 },
  581: { name: 'Small Artillery Cannons', parentId: 560 },
  582: { name: 'Medium Artillery Cannons', parentId: 560 },
  583: { name: 'Large Artillery Cannons', parentId: 560 },
  584: { name: 'XL Artillery Cannons', parentId: 560 },

  140: { name: 'Missile Launchers', parentId: 10 },
  639: { name: 'Rocket Launchers', parentId: 140 },
  640: { name: 'Light Missile Launchers', parentId: 140 },
  641: { name: 'Rapid Light Missile Launchers', parentId: 140 },
  642: { name: 'Heavy Launchers', parentId: 140 },
  974: { name: 'Heavy Assault Launchers', parentId: 140 },
  1827: { name: 'Rapid Heavy Missile Launchers', parentId: 140 },
  643: { name: 'Cruise Launchers', parentId: 140 },
  644: { name: 'Torpedo Launchers', parentId: 140 },
  2247: { name: 'Rapid Torpedo Launchers', parentId: 140 },
  777: { name: 'XL Launchers', parentId: 140 },
  2351: { name: 'Defender Launchers', parentId: 140 },

  2431: { name: 'Precursor Turrets', parentId: 10 },
  2741: { name: 'Vorton Projectors', parentId: 10 },
  143: { name: 'Weapon Upgrades', parentId: 10 },
  645: { name: 'Ballistic Control Systems', parentId: 143 },
  646: { name: 'Gyrostabilizers', parentId: 143 },
  647: { name: 'Heat Sinks', parentId: 143 },
  648: { name: 'Magnetic Field Stabilizers', parentId: 143 },
  2032: { name: 'Missile Guidance Computers', parentId: 143 },
  2033: { name: 'Missile Guidance Enhancers', parentId: 143 },
  706: { name: 'Tracking Computers', parentId: 143 },
  707: { name: 'Tracking Enhancers', parentId: 143 },
  708: { name: 'Remote Tracking Computers', parentId: 143 },
  2471: { name: 'Entropic Radiation Sinks', parentId: 143 },
  2740: { name: 'Vorton Tuning Systems', parentId: 143 },
  801: { name: 'Siege Modules', parentId: 143 },

  1014: { name: 'Bomb Launchers', parentId: 10 },
  3726: { name: 'Breacher Pod Launchers', parentId: 10 },
  912: { name: 'Superweapons', parentId: 10 },

  // Hull & Armor (14)
  133: { name: 'Armor Plates', parentId: 14 },
  1672: { name: '100mm Armor Plates', parentId: 133 },
  1676: { name: '200mm Armor Plates', parentId: 133 },
  1673: { name: '400mm Armor Plates', parentId: 133 },
  2240: { name: '800mm Armor Plates', parentId: 133 },
  1674: { name: '1600mm Armor Plates', parentId: 133 },
  1675: { name: '25000mm Armor Plates', parentId: 133 },

  134: { name: 'Armor Repairers', parentId: 14 },
  1049: { name: 'Small Armor Repairers', parentId: 134 },
  1050: { name: 'Medium Armor Repairers', parentId: 134 },
  1051: { name: 'Large Armor Repairers', parentId: 134 },
  1052: { name: 'Extra Large Armor Repairers', parentId: 134 },

  535: { name: 'Armor Hardeners', parentId: 14 },
  2118: { name: 'EM Armor Hardeners', parentId: 535 },
  2119: { name: 'Explosive Armor Hardeners', parentId: 535 },
  2120: { name: 'Kinetic Armor Hardeners', parentId: 535 },
  2121: { name: 'Multispectrum Armor Hardeners', parentId: 535 },
  2122: { name: 'Thermal Armor Hardeners', parentId: 535 },

  540: { name: 'Armor Resistance Coatings', parentId: 14 },
  541: { name: 'Energized Armor Resistance Membranes', parentId: 14 },
  
  537: { name: 'Remote Armor Repairers', parentId: 14 },
  2164: { name: 'Small Remote Armor Repairers', parentId: 537 },
  2165: { name: 'Medium Remote Armor Repairers', parentId: 537 },
  2166: { name: 'Large Remote Armor Repairers', parentId: 537 },
  2167: { name: 'Capital Remote Armor Repairers', parentId: 537 },
  
  2527: { name: 'Mutadaptive Remote Armor Repairers', parentId: 14 },
  538: { name: 'Hull Repairers', parentId: 14 },
  1018: { name: 'Remote Hull Repairers', parentId: 14 },
  135: { name: 'Hull Upgrades', parentId: 14 },
  1195: { name: 'Reinforced Bulkheads', parentId: 135 },
  1196: { name: 'Nanofiber Internal Structures', parentId: 135 },
  1197: { name: 'Expanded Cargoholds', parentId: 135 },
  615: { name: 'Damage Controls', parentId: 14 },
  1669: { name: 'Layered Armor Coatings', parentId: 14 },
  1687: { name: 'Layered Energized Armor Membranes', parentId: 14 },
  2509: { name: 'Mass Entanglers', parentId: 14 },

  // Shield (44)
  552: { name: 'Shield Boosters', parentId: 44 },
  609: { name: 'Small Shield Boosters', parentId: 552 },
  610: { name: 'Medium Shield Boosters', parentId: 552 },
  611: { name: 'Large Shield Boosters', parentId: 552 },
  612: { name: 'Extra Large Shield Boosters', parentId: 552 },
  778: { name: 'Capital Shield Boosters', parentId: 552 },

  128: { name: 'Remote Shield Boosters', parentId: 44 },
  2160: { name: 'Small Remote Shield Boosters', parentId: 128 },
  2161: { name: 'Medium Remote Shield Boosters', parentId: 128 },
  2162: { name: 'Large Remote Shield Boosters', parentId: 128 },
  2163: { name: 'Capital Remote Shield Boosters', parentId: 128 },

  551: { name: 'Shield Extenders', parentId: 44 },
  601: { name: 'Small Shield Extenders', parentId: 551 },
  602: { name: 'Medium Shield Extenders', parentId: 551 },
  603: { name: 'Large Shield Extenders', parentId: 551 },

  553: { name: 'Shield Hardeners', parentId: 44 },
  2123: { name: 'EM Shield Hardeners', parentId: 553 },
  2124: { name: 'Explosive Shield Hardeners', parentId: 553 },
  2125: { name: 'Kinetic Shield Hardeners', parentId: 553 },
  2126: { name: 'Multispectrum Shield Hardeners', parentId: 553 },
  2127: { name: 'Thermal Shield Hardeners', parentId: 553 },

  550: { name: 'Shield Resistance Amplifiers', parentId: 44 },
  126: { name: 'Shield Rechargers', parentId: 44 },
  687: { name: 'Shield Flux Coils', parentId: 44 },
  688: { name: 'Shield Power Relays', parentId: 44 },

  // Propulsion (52)
  542: { name: 'Afterburners', parentId: 52 },
  1159: { name: 'Small Afterburners', parentId: 542 },
  1160: { name: 'Medium Afterburners', parentId: 542 },
  1161: { name: 'Large Afterburners', parentId: 542 },

  131: { name: 'Microwarpdrives', parentId: 52 },
  1154: { name: 'Small Microwarpdrives', parentId: 131 },
  1155: { name: 'Medium Microwarpdrives', parentId: 131 },
  1156: { name: 'Large Microwarpdrives', parentId: 131 },
  1533: { name: 'Capital Microwarpdrives', parentId: 131 },

  1650: { name: 'Micro Jump Drives', parentId: 52 },
  2135: { name: 'Micro Jump Field Generators', parentId: 52 },
  132: { name: 'Propulsion Upgrades', parentId: 52 },

  // Engineering Equipment (655)
  660: { name: 'Auxiliary Power Controls', parentId: 655 },
  664: { name: 'Capacitor Batteries', parentId: 655 },
  1113: { name: 'Small Capacitor Batteries', parentId: 664 },
  1114: { name: 'Medium Capacitor Batteries', parentId: 664 },
  1115: { name: 'Large Capacitor Batteries', parentId: 664 },
  1534: { name: 'Capital Capacitor Batteries', parentId: 664 },

  668: { name: 'Capacitor Boosters', parentId: 655 },
  1116: { name: 'Small Capacitor Boosters', parentId: 668 },
  1117: { name: 'Medium Capacitor Boosters', parentId: 668 },
  1118: { name: 'Heavy Capacitor Boosters', parentId: 668 },
  1535: { name: 'Capital Capacitor Boosters', parentId: 668 },
  665: { name: 'Capacitor Rechargers', parentId: 655 },
  666: { name: 'Capacitor Flux Coils', parentId: 655 },
  667: { name: 'Capacitor Power Relays', parentId: 655 },
  658: { name: 'Power Diagnostic Systems', parentId: 655 },
  659: { name: 'Reactor Control Units', parentId: 655 },
  
  661: { name: 'Energy Neutralizers', parentId: 655 },
  1053: { name: 'Small Energy Neutralizers', parentId: 661 },
  1054: { name: 'Medium Energy Neutralizers', parentId: 661 },
  1055: { name: 'Large Energy Neutralizers', parentId: 661 },
  1056: { name: 'Heavy Energy Neutralizers', parentId: 661 },
  
  662: { name: 'Energy Nosferatu', parentId: 655 },
  1057: { name: 'Small Energy Nosferatu', parentId: 662 },
  1058: { name: 'Medium Energy Nosferatu', parentId: 662 },
  1059: { name: 'Large Energy Nosferatu', parentId: 662 },
  1060: { name: 'Heavy Energy Nosferatu', parentId: 662 },
  
  663: { name: 'Remote Capacitor Transmitters', parentId: 655 },
  2168: { name: 'Small Remote Capacitor Transmitters', parentId: 663 },
  2169: { name: 'Medium Remote Capacitor Transmitters', parentId: 663 },
  2170: { name: 'Large Remote Capacitor Transmitters', parentId: 663 },
  2171: { name: 'Capital Remote Capacitor Transmitters', parentId: 663 },
  1297: { name: 'Jump Drive Economizers', parentId: 655 },

  // Electronics and Sensor Upgrades (656)
  670: { name: 'Automated Targeting Systems', parentId: 656 },
  675: { name: 'Cloaking Devices', parentId: 656 },
  676: { name: 'CPU Upgrades', parentId: 656 },
  672: { name: 'Passive Targeting Systems', parentId: 656 },
  673: { name: 'Remote Sensor Boosters', parentId: 656 },
  671: { name: 'Sensor Boosters', parentId: 656 },
  669: { name: 'Signal Amplifiers', parentId: 656 },
  872: { name: 'Tractor Beams', parentId: 656 },

  // Electronic Warfare (657)
  677: { name: 'Electronic Counter Measures', parentId: 657 },
  678: { name: 'ECM Bursts', parentId: 657 },
  685: { name: 'ECCM', parentId: 657 },
  686: { name: 'Projected ECCM', parentId: 657 },
  679: { name: 'Remote Sensor Dampeners', parentId: 657 },
  681: { name: 'Sensor Backup Arrays', parentId: 657 },
  683: { name: 'Stasis Webifiers', parentId: 657 },
  2154: { name: 'Stasis Grapplers', parentId: 657 },
  757: { name: 'Target Painters', parentId: 657 },
  1935: { name: 'Warp Disruptors', parentId: 657 },
  1936: { name: 'Warp Scramblers', parentId: 657 },
  1085: { name: 'Warp Disruption Field Generators', parentId: 657 },
  1937: { name: 'Interdiction Sphere Launchers', parentId: 657 },
  680: { name: 'Weapon Disruptors', parentId: 657 },
  2249: { name: 'Burst Projectors', parentId: 657 },
  1426: { name: 'Signature Suppressor', parentId: 657 },

  // Fleet Assistance Modules (779)
  1633: { name: 'Command Bursts', parentId: 779 },
  1639: { name: 'Command Processors', parentId: 779 },
  1641: { name: 'Cynosural Field Generators', parentId: 779 },
  1640: { name: 'Jump Portal Generators', parentId: 779 },
  1642: { name: 'Clone Vat Bays', parentId: 779 },

  // Scanning Equipment (1708)
  1718: { name: 'Analyzers', parentId: 1708 },
  711: { name: 'Cargo Scanners', parentId: 1708 },
  2018: { name: 'Entosis Links', parentId: 1708 },
  714: { name: 'Mining Survey Chipsets', parentId: 1708 },
  712: { name: 'Scan Probe Launchers', parentId: 1708 },
  1709: { name: 'Scanning Upgrades', parentId: 1708 },
  713: { name: 'Ship Scanners', parentId: 1708 },
  1717: { name: 'Survey Probe Launchers', parentId: 1708 },

  // Harvest Equipment (1713)
  1039: { name: 'Mining Lasers', parentId: 1713 },
  1040: { name: 'Strip Miners', parentId: 1713 },
  1038: { name: 'Ice Harvesters', parentId: 1713 },
  2151: { name: 'Ice Mining Lasers', parentId: 1713 },
  2795: { name: 'Gas Cloud Harvesters', parentId: 1713 },
  1037: { name: 'Gas Cloud Scoops', parentId: 1713 },
  935: { name: 'Mining Upgrades', parentId: 1713 },
  1715: { name: 'Salvagers', parentId: 1713 },

  // Root: Drones
  157: { name: 'Drones', parentId: null },
  159: { name: 'Combat Drones', parentId: 157 },
  160: { name: 'Light Combat Drones', parentId: 159 },
  161: { name: 'Medium Combat Drones', parentId: 159 },
  162: { name: 'Heavy Combat Drones', parentId: 159 },
  163: { name: 'Sentry Drones', parentId: 159 },
  
  843: { name: 'Combat Utility Drones', parentId: 157 },
  841: { name: 'Electronic Warfare Drones', parentId: 157 },
  
  2236: { name: 'Fighters', parentId: 157 },
  2237: { name: 'Light Fighters', parentId: 2236 },
  2238: { name: 'Support Fighters', parentId: 2236 },
  2239: { name: 'Heavy Fighters', parentId: 2236 },
  
  842: { name: 'Logistic Drones', parentId: 157 },
  844: { name: 'Small Logistic Drones', parentId: 842 },
  845: { name: 'Medium Logistic Drones', parentId: 842 },
  846: { name: 'Large Logistic Drones', parentId: 842 },
  
  158: { name: 'Mining Drones', parentId: 157 },
  1646: { name: 'Salvage Drones', parentId: 157 },
  
  // Root: Ship and Module Modifications
  955: { name: 'Ship and Module Modifications', parentId: null },
  2436: { name: 'Mutaplasmids', parentId: 955 },
  2437: { name: 'Armor Mutaplasmids', parentId: 2436 },
  2438: { name: 'Shield Mutaplasmids', parentId: 2436 },
  2439: { name: 'Astronautic Mutaplasmids', parentId: 2436 },
  2440: { name: 'Engineering Mutaplasmids', parentId: 2436 },
  2441: { name: 'Warp Disruption Mutaplasmids', parentId: 2436 },
  2442: { name: 'Stasis Webifier Mutaplasmids', parentId: 2436 },
  2512: { name: 'Weapon Upgrade Mutaplasmids', parentId: 2436 },
  2532: { name: 'Damage Control Mutaplasmids', parentId: 2436 },
  3667: { name: 'Smartbomb Mutaplasmids', parentId: 2436 },
  3719: { name: 'Drone Mutaplasmids', parentId: 2436 },
  3786: { name: 'Harvesting Mutaplasmids', parentId: 2436 },
  
  1111: { name: 'Rigs', parentId: 955 },
  956: { name: 'Armor Rigs', parentId: 1111 },
  965: { name: 'Shield Rigs', parentId: 1111 },
  957: { name: 'Astronautic Rigs', parentId: 1111 },
  960: { name: 'Electronic Superiority Rigs', parentId: 1111 },
  961: { name: 'Engineering Rigs', parentId: 1111 },
  963: { name: 'Hybrid Weapon Rigs', parentId: 1111 },
  979: { name: 'Projectile Weapon Rigs', parentId: 1111 },
  962: { name: 'Energy Weapon Rigs', parentId: 1111 },
  964: { name: 'Missile Launcher Rigs', parentId: 1111 },
  958: { name: 'Drone Rigs', parentId: 1111 },
  1779: { name: 'Resource Processing Rigs', parentId: 1111 },
  1780: { name: 'Scanning Rigs', parentId: 1111 },
  1781: { name: 'Targeting Rigs', parentId: 1111 },
  2331: { name: 'Precursor Weapon Rigs', parentId: 1111 },
  
  1112: { name: 'Subsystems', parentId: 955 },
  1610: { name: 'Amarr Subsystems', parentId: 1112 },
  1625: { name: 'Caldari Subsystems', parentId: 1112 },
  1627: { name: 'Gallente Subsystems', parentId: 1112 },
  1626: { name: 'Minmatar Subsystems', parentId: 1112 },

  // Root: Structures
  2202: { name: 'Structures', parentId: null },
  2203: { name: 'Citadels', parentId: 2202 },
  2324: { name: 'Engineering Complexes', parentId: 2202 },
  2327: { name: 'Refineries', parentId: 2202 },
  2510: { name: 'FLEX Structures', parentId: 2202 },
  2210: { name: 'Structure Modules', parentId: 2202 },
  2206: { name: 'Electronic Warfare', parentId: 2210 },
  2207: { name: 'Electronics and Sensor Upgrades', parentId: 2210 },
  2209: { name: 'Service Modules', parentId: 2202 },
  2211: { name: 'Structure Rigs', parentId: 2202 },
  2356: { name: 'Quantum Cores', parentId: 2202 },
  1367: { name: 'Deployable Structures', parentId: 2202 },

  // Root: Special Edition Assets
  1922: { name: 'Special Edition Assets', parentId: null },
  1821: { name: 'Special Edition Festival Assets', parentId: 1922 },
  
  // Legacy/Other
  999: { name: 'Other Ship Equipment', parentId: 9 },
  1000: { name: 'Miscellaneous High Slot', parentId: 999 },
  1001: { name: 'Miscellaneous Med Slot', parentId: 999 },
  1002: { name: 'Miscellaneous Low Slot', parentId: 999 },
}

export const GROUP_TO_MARKET_GROUP: Record<number, number> = {
  // --- HIGH SLOT: WEAPONS ---
  // Energy Turrets
  455: 565, 456: 566, 457: 567, 458: 568, // Pulse
  495: 561, 496: 562, 497: 563, 498: 564, // Beam
  53: 10,   // Energy Weapon
  
  // Hybrid Turrets
  451: 569, 452: 570, 453: 571, 454: 572, // Blaster
  487: 573, 488: 574, 489: 575, 490: 576, // Railgun
  74: 10,   // Hybrid Weapon
  
  // Projectile Turrets
  459: 577, 460: 578, 461: 579, 462: 580, // Autocannon
  491: 581, 492: 582, 493: 583, 494: 584, // Artillery
  55: 10,   // Projectile Weapon
  
  // Missiles
  506: 639,  // Rocket
  507: 640,  // Light Missile
  508: 641,  // Rapid Light Missile
  509: 642,  // Heavy Missile
  510: 974,  // Heavy Assault Missile
  511: 1827, // Rapid Heavy Missile
  512: 643,  // Cruise Missile
  513: 644,  // Torpedo
  514: 2247, // Rapid Torpedo
  524: 777,  // XL Missile
  2351: 2351, // Defender Missile
  56: 10,    // Missile Launcher
  771: 642,  // Missile Launcher Heavy Assault
  862: 1014, // Missile Launcher Bomb
  1245: 1827, // Missile Launcher Rapid Heavy
  1673: 2247, // Missile Launcher Rapid Torpedo
  1674: 777,  // Missile Launcher XL Cruise
  
  // Precursor & Vorton
  1722: 2431, // Entropic Disintegrator
  4060: 2741, // Vorton Projector
  1986: 2431, // Precursor Weapon
  
  // Weapon Upgrades
  376: 645, 302: 646, 205: 647, 59: 648, // BCU, Gyro, Heat Sink, Mag Stab
  367: 645,  // Ballistic Control System
  1395: 2033, // Missile Guidance Enhancer
  1396: 2032, // Missile Guidance Computer
  1988: 2471, // Entropic Radiation Sink
  4067: 2740, // Vorton Projector Upgrade
  515: 801,   // Siege Module
  
  // --- MID SLOT ---
  // Shield
  38: 551,  // Shield Extender
  39: 126,  // Shield Recharger
  40: 552,  // Shield Booster
  41: 128,  // Remote Shield Booster
  77: 553,  // Shield Hardener
  553: 553, // Multi-hardener
  295: 550, // Shield Res Amp
  338: 552, // Large Shield Booster
  1156: 552, // Ancillary Shield Booster
  1697: 128, // Ancillary Remote Shield Booster
  1700: 553, // Flex Shield Hardener
  57: 688,   // Shield Power Relay
  770: 687,  // Shield Flux Coil
  
  // Propulsion
  46: 542,  // Afterburner
  131: 131, // MWD
  475: 131, // Microwarpdrive
  1650: 1650, // MJD
  1189: 2135, // Micro Jump Drive
  2135: 2135, // MJFG
  1533: 2135, // Micro Jump Field Generators
  315: 132,   // Warp Core Stabilizer
  638: 132,   // Navigation Computer
  762: 132,   // Inertial Stabilizer
  764: 132,   // Overdrive Injector System
  1289: 52,    // Warp Accelerator
  4117: 52,    // Interdiction Nullifier
  4769: 52,    // Capital Mobility Modules
  
  // EWAR
  201: 677, // ECM
  202: 685, // ECCM
  208: 679, // Remote Sensor Dampener
  65: 683,  // Stasis Webifier
  2154: 2154, // Stasis Grappler
  379: 757, // Target Painter
  1935: 1935, // Warp Disruptor
  1936: 1936, // Warp Scrambler
  52: 1936,   // Warp Scrambler
  80: 678,    // Burst Jammer
  289: 686,   // Projected ECCM
  291: 680,   // Weapon Disruptor
  1672: 2154, // Stasis Grappler
  899: 1085,  // Warp Disrupt Field Generator
  589: 1937,  // Interdiction Sphere Launcher
  1154: 1426, // Signature Suppressor
  842: 2249,  // Burst Projectors
  405: 657,   // Anti Cloaking Pulse
  2013: 657,  // Stasis Nullifiers
  
  // Sensors
  82: 672,  // Passive Targeter
  96: 670,  // Auto Targeter
  210: 669,  // Signal Amplifier
  212: 671,  // Sensor Booster
  213: 706,  // Tracking Computer
  290: 673,  // Remote Sensor Booster
  203: 681,  // Sensor Backup Array
  209: 674,  // Remote Tracking Computer
  211: 707,  // Tracking Enhancer
  285: 676,  // CPU Enhancer
  330: 675,  // Cloaking Device
  650: 872,  // Tractor Beam
  1706: 656, // Capital Sensor Array
  878: 656,  // Cloak Enhancements
  
  // --- LOW SLOT ---
  // Armor
  62: 134,  // Armor Repairer
  63: 538,  // Hull Repairer
  98: 133,  // Armor Plate
  329: 133, // Armor Plate (Steel)
  535: 535, // Armor Hardener
  328: 535, // Armor Hardener
  540: 540, // Armor Resistance Coating
  541: 541, // EANM
  326: 541, // Energized Armor Membrane
  615: 615, // Damage Control
  60: 615,  // Damage Control
  78: 135,  // Reinforced Bulkhead
  325: 537, // Remote Armor Repairer
  1199: 134, // Ancillary Armor Repairer
  1698: 537, // Ancillary Remote Armor Repairer
  1699: 535, // Flex Armor Hardener
  2008: 2509, // Mass Entanglers
  763: 135,  // Nanofiber Internal Structure
  765: 135,  // Expanded Cargohold
  1150: 535, // Armor Resistance Shift Hardener
  1894: 535, // Non-Repeating Hardeners -> Armor Hardeners
  2018: 2527, // Mutadaptive Remote Armor Repairer
  
  // Engineering
  43: 665,  // Capacitor Recharger
  4174: 2815, // Compressors
  546: 935,   // Mining Upgrade
  901: 935,   // Mining Enhancer
  61: 664,  // Capacitor Battery
  76: 668,  // Capacitor Booster
  67: 663,  // Remote Cap Transmitter
  68: 662,  // Energy Nosferatu
  71: 661,  // Energy Neutralizer
  769: 658, // Power Diagnostic System
  766: 659, // Reactor Control Unit
  339: 660, // Auxiliary Power Core
  767: 667, // Capacitor Power Relay
  768: 666, // Capacitor Flux Coil
  1299: 1297, // Jump Drive Economizer
  
  // --- DRONES ---
  100: 159,  // Combat Drone
  516: 2236, // Fighter
  831: 842,  // Logistic Drone
  641: 841,  // EWAR Drone
  1111: 158, // Mining Drone
  1646: 1646, // Salvage Drone
  1353: 2236, // Light Fighter
  1354: 2236, // Support Fighter
  1355: 2236, // Heavy Fighter
  1356: 2236, // Standup Light Fighter
  1357: 2236, // Standup Heavy Fighter
  1358: 2236, // Standup Support Fighter
  883: 157,   // Survey Drone
  1041: 158,  // Industrial Drone
  357: 938,  // DroneBayExpander
  407: 938,  // Fighter Support Unit
  586: 938,  // Drone Modules
  644: 938,  // Drone Navigation Computer
  645: 938,  // Drone Damage Modules
  646: 938,  // Drone Tracking Modules
  647: 938,  // Drone Control Range Module
  1292: 938, // Drone Tracking Enhancer
  
  // --- FLEET ASSISTANCE ---
  316: 1633,  // Gang Coordinator -> Command Bursts
  113: 1633,  // Gang Coordinator -> Command Bursts
  642: 779,  // Super Gang Enhancer
  1770: 1633, // Command Burst
  658: 1641, // Cynosural Field Generator
  905: 1641, // Covert Cynosural Field Generator
  590: 1640, // Jump Portal Generator
  4127: 1640, // Covert Jump Portal Generator
  4184: 1640, // Industrial Jump Portal Generator
  815: 1642, // Clone Vat Bay
  
  // --- HARVEST & SCANNERS ---
  54: 1039, 464: 1040, 483: 1038, 1222: 2795, // Mining, Strip, Ice, Gas
  737: 1037, // Gas Cloud Scoops
  2004: 1039, // Citizen Mining Laser -> Mining Lasers
  4138: 2795, // Gas Cloud Harvesters
  585: 1715, // Salvager
  1122: 1715, // Salvager
  486: 712, 1073: 712, // Scan Probe Launchers
  481: 712, // Scan Probe Launcher
  751: 1718, 752: 1718, 753: 1718, // Analyzers
  538: 1718, // Data Miners
  47: 711,   // Cargo Scanner
  48: 713,   // Ship Scanner
  49: 714,   // Mining Survey Chipset
  1226: 1717, // Survey Probe Launcher
  1223: 1709, // Scanning Upgrade
  1238: 1709, // Scanning Upgrade Time
  472: 1708,  // System Scanner -> Scanning Equipment
  1313: 2018, // Entosis Link
  
  // --- RIGS ---
  773: 956, 774: 965, 775: 957, 776: 960, 777: 961,
  778: 963, 779: 979, 780: 962, 781: 964, 782: 958,
  1301: 2331, // Precursor Rigs
  786: 959,   // Rig Electronic Systems
  1232: 1232, // Rig Resource Processing
  1233: 1233, // Rig Scanning
  1234: 1234, // Rig Targeting
  904: 1232,  // Rig Mining
  896: 1111,  // Rig Security Transponder
  
  // --- WEAPONS MISC ---
  72: 141,   // Smart Bomb
  406: 141,  // Smartbomb Supercharger
  588: 912,  // Super Weapon
  1815: 912, // Titan Phenomena Generator
  308: 1014, // Countermeasure Launcher
  501: 1821, // Festival Launcher -> Special Edition Festival Assets
  4807: 3726, // Breacher Pod Launchers
  
  // --- OTHER / CITIZEN ---
  2003: 999, // Citizen Modules -> Other Ship Equipment

  // Subsystems
  950: 1610, 951: 1610, 952: 1610, 953: 1610, 954: 1610, // Amarr
  955: 1625, 956: 1625, 957: 1625, 958: 1625, 959: 1625, // Caldari
  960: 1627, 961: 1627, 962: 1627, 963: 1627, 964: 1627, // Gallente
  965: 1626, 966: 1626, 967: 1626, 968: 1626, 969: 1626, // Minmatar
  
  // Structure Modules
  1306: 2209, // SDE: Structure Service -> Market: Service Modules
  2211: 2206, // EW
  2212: 2206, 2213: 2206, 2408: 2206, 2214: 2206, 2216: 2206, 2215: 2206,
  2218: 2207, 2219: 2207,
  2414: 2208, 2224: 2208, 2220: 2208, 2223: 2208, 2221: 2208, 2222: 2208,
  2228: 2210, 2229: 2210, 2226: 2210, 2227: 2210, // Market: Structure Modules
  
  // Tactical Destroyer
  1308: 1819,

  // Deployables
  1273: 1367, 1297: 1367, 1249: 1367, 1246: 1367, 1247: 1367,

  2038: 2356, // Quantum Cores

  // Mutaplasmids
  1964: 2437, 1965: 2437,
  1966: 2438, 1967: 2438,
  1968: 2439,
  1969: 2440,
  1970: 2441,
  1971: 2442,
  1972: 2512,
  1973: 2532,
  1975: 3719,
}

export const GENERIC_GROUP_SPLITS: Record<number, Array<{ keywords: string[]; targetId: number }>> = {
  // Armor Repairers (134)
  134: [
    { keywords: ['Extra Large', 'XL'], targetId: 1052 },
    { keywords: ['Large'], targetId: 1051 },
    { keywords: ['Medium'], targetId: 1050 },
    { keywords: ['Small'], targetId: 1049 },
  ],
  // Armor Plates (133)
  133: [
    { keywords: ['25000mm', '25,000mm'], targetId: 1675 },
    { keywords: ['1600mm'], targetId: 1674 },
    { keywords: ['800mm'], targetId: 2240 },
    { keywords: ['400mm'], targetId: 1673 },
    { keywords: ['200mm'], targetId: 1676 },
    { keywords: ['100mm'], targetId: 1672 },
  ],
  // Shield Boosters (552)
  552: [
    { keywords: ['Capital'], targetId: 778 },
    { keywords: ['Extra Large', 'XL'], targetId: 612 },
    { keywords: ['Large'], targetId: 611 },
    { keywords: ['Medium'], targetId: 610 },
    { keywords: ['Small'], targetId: 609 },
  ],
  // Smartbombs (141)
  141: [
    { keywords: ['Large'], targetId: 381 },
    { keywords: ['Medium'], targetId: 383 },
    { keywords: ['Small'], targetId: 382 },
    { keywords: ['Micro'], targetId: 380 },
  ],
  // Afterburners (542)
  542: [
    { keywords: ['Large', '100MN'], targetId: 1161 },
    { keywords: ['Medium', '10MN'], targetId: 1160 },
    { keywords: ['Small', '1MN'], targetId: 1159 },
  ],
  // Microwarpdrives (131)
  131: [
    { keywords: ['Capital', '50000MN'], targetId: 1533 },
    { keywords: ['Large', '500MN'], targetId: 1156 },
    { keywords: ['Medium', '50MN'], targetId: 1155 },
    { keywords: ['Small', '5MN'], targetId: 1154 },
  ],
  // Energy Neutralizers (661)
  661: [
    { keywords: ['Capital', 'Heavy'], targetId: 1056 },
    { keywords: ['Large'], targetId: 1055 },
    { keywords: ['Medium'], targetId: 1054 },
    { keywords: ['Small'], targetId: 1053 },
  ],
  // Energy Nosferatu (662)
  662: [
    { keywords: ['Capital', 'Heavy'], targetId: 1060 },
    { keywords: ['Large'], targetId: 1059 },
    { keywords: ['Medium'], targetId: 1058 },
    { keywords: ['Small'], targetId: 1057 },
  ],
  // Remote Armor Repairers (537)
  537: [
    { keywords: ['Capital'], targetId: 2167 },
    { keywords: ['Large'], targetId: 2166 },
    { keywords: ['Medium'], targetId: 2165 },
    { keywords: ['Small'], targetId: 2164 },
  ],
  // Remote Shield Boosters (128)
  128: [
    { keywords: ['Capital'], targetId: 2163 },
    { keywords: ['Large'], targetId: 2162 },
    { keywords: ['Medium'], targetId: 2161 },
    { keywords: ['Small'], targetId: 2160 },
  ],
  // Remote Capacitor Transmitters (663)
  663: [
    { keywords: ['Capital'], targetId: 2171 },
    { keywords: ['Large'], targetId: 2170 },
    { keywords: ['Medium'], targetId: 2169 },
    { keywords: ['Small'], targetId: 2168 },
  ],
  // Shield Extenders (551)
  551: [
    { keywords: ['Capital'], targetId: 779 },
    { keywords: ['Large'], targetId: 603 },
    { keywords: ['Medium'], targetId: 602 },
    { keywords: ['Small'], targetId: 601 },
  ],
  // Capacitor Batteries (664)
  664: [
    { keywords: ['Capital'], targetId: 1534 },
    { keywords: ['Large'], targetId: 1115 },
    { keywords: ['Medium'], targetId: 1114 },
    { keywords: ['Small'], targetId: 1113 },
  ],
  // Capacitor Boosters (668)
  668: [
    { keywords: ['Capital'], targetId: 1535 },
    { keywords: ['Heavy', 'Large'], targetId: 1118 },
    { keywords: ['Medium'], targetId: 1117 },
    { keywords: ['Small'], targetId: 1116 },
  ],
  // Armor Hardeners (535)
  535: [
    { keywords: ['EM'], targetId: 2118 },
    { keywords: ['Explosive'], targetId: 2119 },
    { keywords: ['Kinetic'], targetId: 2120 },
    { keywords: ['Multispectrum'], targetId: 2121 },
    { keywords: ['Thermal'], targetId: 2122 },
  ],
  // Shield Hardeners (553)
  553: [
    { keywords: ['EM'], targetId: 2123 },
    { keywords: ['Explosive'], targetId: 2124 },
    { keywords: ['Kinetic'], targetId: 2125 },
    { keywords: ['Multispectrum'], targetId: 2126 },
    { keywords: ['Thermal'], targetId: 2127 },
  ],
  // Citizen Modules (2003)
  2003: [
    { keywords: ['Armor Repairer'], targetId: 1049 }, // Small Armor Repairer
    { keywords: ['Shield Booster'], targetId: 609 },  // Small Shield Booster
    { keywords: ['Railgun'], targetId: 573 },        // Small Railgun
    { keywords: ['Pulse Laser'], targetId: 565 },     // Small Pulse Laser
    { keywords: ['Beam Laser'], targetId: 561 },      // Small Beam Laser
    { keywords: ['Autocannon'], targetId: 577 },      // Small Autocannon
    { keywords: ['Artillery'], targetId: 581 },       // Small Artillery
    { keywords: ['Blaster'], targetId: 569 },         // Small Blaster
  ],
  // Combat Drones (159)
  159: [
    { keywords: ['Sentry', 'Garde', 'Curator', 'Warden', 'Bouncer'], targetId: 163 },
    { keywords: ['Heavy', 'Ogre', 'Praetor', 'Wasp', 'Berserker', 'Gecko'], targetId: 162 },
    { keywords: ['Medium', 'Hammerhead', 'Infiltrator', 'Vespa', 'Valkyrie', 'Augmented'], targetId: 161 },
    { keywords: ['Light', 'Hobgoblin', 'Acolyte', 'Hornet', 'Warrior'], targetId: 160 },
  ],
  // Fighters (2236)
  2236: [
    { keywords: ['Heavy'], targetId: 2239 },
    { keywords: ['Support'], targetId: 2238 },
    { keywords: ['Light'], targetId: 2237 },
  ],
  // Logistic Drones (842)
  842: [
    { keywords: ['Large'], targetId: 846 },
    { keywords: ['Medium'], targetId: 845 },
    { keywords: ['Small'], targetId: 844 },
  ],
}

// Market groups that should NOT create tier subcategories
export const NO_TIER_SUBFOLDERS = [
  657, 956, 965, 957, 960, 961, 963, 979, 962, 964, 958, 1779, 1780, 1781, 1159, 
  2436, 2206, 2207, 2208, 2209, 2210, 2749, 
  561, 562, 563, 564, 565, 566, 567, 568, 573, 574, 575, 576, 569, 570, 571, 572, 
  577, 578, 579, 580, 581, 582, 583, 584,
  1049, 1050, 1051, 1052, 609, 610, 611, 612, 778, // Repairers/Boosters
  2118, 2119, 2120, 2121, 2122, // Armor Hardeners
  2123, 2124, 2125, 2126, 2127, // Shield Hardeners
  380, 381, 382, 383, 1205, 1202, 1204, 1203, // Smartbombs
  1819, // Tactical Destroyer Modes
  2203, 2324, 2327, 2510, 2356, 1821, // Structures & Special
  160, 161, 162, 163, // Drone Sizes
  2237, 2238, 2239, // Fighter Sizes
  844, 845, 846, // Logistic Drone Sizes
]

export const META_GROUP_ORDER: Record<string, number> = {
  'Tech I': 1,
  'Tech II': 2,
  'Tech III': 3,
  'Standard': 4,
  'Faction': 5,
  'Storyline': 6,
  'Deadspace': 7,
  'Officer': 8,
  'Abyssal': 9,
  'Limited Time': 10,
  'Premium': 11,
  'Structure Tech I': 12,
  'Structure Tech II': 13,
  'Structure Faction': 14,
}
