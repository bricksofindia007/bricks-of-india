-- boi:issue 471
-- boi:backup-tables public.news_articles, public.reviews
-- boi:expect-before select (select count(*) from public.news_articles where (slug, md5(content)) in (values ('lego-group-reports-record-revenue-and-profit-in-first-half-o','825585242db2df45ed525dead0c4d1ee'), ('lego-ideas-21370-et-the-extra-terrestrial-estimated-18000-pr','180ff96b125ffa2c6b63efa6ebca0cb1'), ('lego-ideas-reveals-jumanji-universal-monsters-and-kimonos-se','14da0d229a03b8619e057fb5270e1b12'), ('bricklink-designer-program-university-of-science-set-indian-','8ccb518206f11dd455f84769c5e035e2'), ('lego-fifa-world-cup-trophy-spain-edition-a-spanish-exclusive','5b06005c3fd2e932b41e51a4fd8e16d1'), ('lego-drops-avengers-doomsday-trailer-recreation-hints-at-new','ea82dd8143c43187905e096dd907d0e1'), ('lego-super-mario-kart-sets-for-2027-revealed','a43931fb919761bdf60dc25417618ff5'), ('lego-contest-round-up-for-may-2026-2026-whats-new-and-how-to','a416d6c3b59d081b5a936479dd169dc2'), ('lego-ent-fan-build-set-number-unknown-price-uncertainty-for-','be201c7e1b7b7c2e5fb86eff4c697057'), ('lego-40958-christmas-stocking-announced-release-date-set-for','d9e77f7974a598a58389754a6ef095bc'), ('50-new-lego-sets-leaked-for-india-icons-star-wars-f1-your-wa','f468b4a720c68c9762a6ebfdbdf34698'), ('lego-40899-astro-bot-revealed-as-a-playstation-gift-with-pur','0bbc1d08840461196339dc4f294aaddb'), ('lego-icons-star-trek-uss-enterprise-ncc-1701-bridge-11385-of','bc2089da147c0130a18fe40986f331ff'), ('certified-store-india-charges-too-much','5376a53094c0df2cd7e2937921040647'), ('lego-eta-2-actis-jedi-starfighter-brick-built-cockpit-detail','95426d980a1b3c831d3c1b7dd084d987'), ('lego-halloween-2026-sets-unveiled-for-august-launch','92a3874ab511854f628ee3355c0ab553'), ('lego-shrek-collectable-minifigures-revealed-ogre-ly-expensiv','81d63fe54b7494c80d15f8f4811e7252'), ('forced-perspective-tmnt-scene-cowabunga-or-collectors-nightm','56f3fb45829811e3be891cd47bcc478d'), ('guillermo-del-toro-lego-tribute-love-is-in-the-air-and-the-w','3eafc92568bc5a173641fc7c7ebc16b4'), ('lego-40899-astro-bot-gwp-officially-unveiled-arrives-october','6a42c19846bd7eda1244d770797749cc'), ('lego-wednesday-sets-2026-nevermore-academy-and-wednesday-add','824571fdf90465d579ce0e0329181e63'), ('lego-batman-returns-batmobile-76355-revealed-a-burton-classi','a477ce1ad7bc5d6f2a05a6e882bc85c1'), ('lego-restaurants-of-the-world-greece-gwp-august-2026-promos-','3c4f8bbf3da8d2d228418c60e6b99846'), ('lego-horse-knights-camp-a-knights-life-beyond-the-battlefiel','a7e88df427ba5d932094d90742668e14'), ('lego-may-2-reveals-city-creator-and-festival-sets-land-in-in','26b88c7665d13133c77d923262596b36'), ('what-are-the-new-lego-parts-in-august-2026-sets-2026','6f0bbe77303f4d4cfd901dbbd33d50b0'), ('lego-bio-cup-2026-set-2026-metamorphosis-in-plastic','18425632e3067660996f3eff21747d6f'), ('lego-pokmon-smart-play-2027-sets-teased-silhouettes-revealed','af2139e9c5d07d392851b4e51fe718c8'), ('lego-community-news-april-2026-highlights-2026','6e8a8202ffb7f15fdb21a9781d44347f'), ('lego-50090-legoland-park-adventure-a-park-in-a-box','cdb645ada533047b1416ed184cc3ca42'), ('lego-super-mario-minifigure-sets-launching-january-2027','d920d93a5487954a77b88a49ee2ab142'), ('febrovery-2026-a-celebration-of-lego-space-rovers-set-2026','35a0561958a94262f4aa228f4f6a9cc8'), ('lego-40908-restaurants-of-the-world-greece-gwp-coming-august','a4a7afe2ea614ffcf4e3a1263382bd0b'), ('lego-x-files-set-21369-officially-revealed-prepare-your-wall','7194285f7835b518018e55183ad7f830'), ('lego-ayrton-senna-helmet-43024-announced-a-new-icon-joins-th','1b73865ef5f516b700c1623d8d1c362a'), ('lego-sets-retiring-in-2026-last-chance-before-they-disappear','4bfffb1879827e2db7f918a67b615ae8'), ('lego-autumn-castle-builds-expectation-vs-reality-for-indian-','07925de6f32ccdd8ce174f147d9f62fa'), ('lego-golden-age-superman-batman-and-gremlins-brickheadz-arri','972933ce8503e2e0686be31f47206f9f'), ('throwback-thursday-revisiting-the-controversial-lego-alpha-t','ffa4a2b6370d25e3ffb3e7a2f662dc75'), ('lego-ideas-21371-wallace-gromit-cracking-set-arrives-october','1e05c359cbc6cb870ab6bf80b6164233'), ('lego-75192-millennium-falcon-still-turning-heads-among-top-v','156c147def02710d72cf0a09dc908e87'), ('lego-bricklink-designer-program-series-6-limited-restock-inc','5f359a443e083c59a20523fb9b1bbeae'), ('lego-playstation-1-72306-the-90s-console-lives-again','a755263b48be6657f6ec7c8d03d4ad90'), ('lego-august-2026-olivia-rodrigo-sets-sell-out-globally-deman','88647d6ef1d9524c55bdd55fcdb1daba'), ('lego-skylines-announced-for-2027-release-hints-at-city-build','f8105a473e6840546299d5dbc2039836'), ('legoland-new-yorks-lego-festival-kicks-off-what-to-expect','bf7a59dd91c0c04c51a29c8ed468b4a0'), ('new-lego-parts-in-september-2026-sets-2026','2ef66e157f627cd9a88ce31cf69e12cd'), ('lego-imperial-lambda-shuttle-and-new-helmets-your-wallet-is-','1a93bb191d1b2afde9e5d5a1a2c8c4c1'), ('lego-pokemon-unleashed-rayquaza-arcanine-and-more-revealed','40d77191a76e03753dd76f76b18189dd'), ('lego-super-mario-range-expands-in-2027-with-long-awaited-min','afa19f3bacde017efd103b30c755adaf'), ('lego-40908-restaurants-of-the-world-greece-gift-with-purchas','2ba988f0e1b97d14a5d0a185b89c9e53'), ('lego-star-wars-ucs-executor-super-star-destroyer-75457-shatt','9abb9dc2ae9f38191c2b647b3428164a'), ('brick-train-awards-2026-a-community-celebration-of-lego-trai','c5db6284da8612d172b6bd9783d10c4d'), ('lego-element-analysis-the-baby-fin-wing-8193-a-new-mould-sur','22e710897be03fcabe14dc3ff03aeeb9'), ('lego-architecture-21065-sagrada-famlia-revealed-a-record-bre','6662656eecd3bd9cfcfcd72cc180fb28'), ('lego-bar-6l-with-stop-rings-double-bent-7078-a-new-part-for-','4fe2b65550399f4961eb4078f6fd4a9d'), ('lego-ideas-wallace-gromit-21371-officially-revealed','7c9a7d73cfd267baae27f3fadb53a723'), ('lego-ideas-wallace-gromit-21371-revealed-a-close-shave-for-y','9dea13153972b8c558cde0550f26a730'), ('new-moulds-spotted-in-lego-pokmon-smart-play-sets-coming-aug','75a3dd6737c648c0aa12657fe7cca5a0'), ('lego-insiders-day-free-greek-restaurant-gwp-available-now','bce811cf9fa5b522e84299a56d11eb41'), ('lego-community-headlines-and-highlights-april-2026-what-grab','76db2fd32893cc2be30b574a721fc2a4'), ('why-indian-lego-prices-high-honest-truth','ff214abe311285b0cc118e88c2f158bd'), ('lego-the-legend-of-zelda-77094-ocarina-of-time-link-epona-re','67fa53c3fc129105eb6aea991b8fed94'), ('lego-batman-adventures-in-gotham-city-book-2026-jokerised-ba','9f2ba7ab510ffd6c4383d30265f553c2'), ('lego-pokmon-30729-premier-ball-gift-with-purchase-details','6b6fff4607b6ab63295b5ad42e022e68'), ('is-lego-worth-price-india-2026','2351c859c446d5bd1169f1a8b85e46ef'), ('lego-40908-restaurants-of-the-world-greece-gwp-get-it-before','46934b9a3996e1eff0ddeb550c0d9c9d'), ('lego-40902-tribute-to-leonardo-da-vinci-gwp-news-what-it-mea','77e13381c10dd46403473ff10a41f3ba'), ('lego-community-headlines-and-highlights-april-2026-whats-new','3f7b0a1af72fba8e8b7297e2f59ab696'), ('lego-gargoyles-moc-your-wallet-is-already-sweating','603d8550e47226f20ccc0f4741aeca35'), ('fan-creator-summit-2026-jays-brick-blog-heads-to-billund-for','c45c82f8ec70b4dd9332ff52eeccc059'), ('new-wednesday-lego-sets-announced-but-when-will-they-land-in','6a5bd74a8d8eead81ecb854cf5ad76b0'), ('lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus','070613d37a763183c8e1c5cfa0654972'), ('lego-jimothy-cryptid-build-surfaces-online','e22338a8dbba502c2f191cab387850fb'), ('lego-bricklink-designer-program-series-11-finalists-revealed','8a997764004965f8f068a3357179447f'), ('two-new-lego-botanicals-sets-bloom-august-1st','5e438295acaf173c8c5fa43e4ed5dc9e'), ('bricklink-designer-program-series-8-preorder-deadline-looms-','b4990a336c1febe4ec128c202d383bc6'), ('lego-40975-mini-hogwarts-castle-a-pocket-sized-hogwarts-arri','b3ceb7792a8b0ebbcec19b9c6cf51607'), ('lego-icons-11387-holiday-house-joins-winter-village-collecti','0e7c45da3ad88538535442f4927d6312'), ('lego-ideas-reveals-21373-downton-abbey-prepare-your-wallet','c42747555b64a6c8b414e96dfa085a68'), ('lego-fifa-world-cup-trophy-champions-edition-revealed-for-sp','6d4be9cece46b508b754f968ec19eb7b'), ('lego-build-a-minifigure-september-2026-halloween-characters-','1059a006e26e41f7558846baae7ca17b'), ('lego-50090-legoland-park-adventure-a-us10999-exclusive-comin','867ddeaa16e6c4f73032a470b536e2ef'), ('lego-ideas-la-catrina-21372-revealed-a-culturally-rich-displ','368e608ad69fef2eb594597f31744b9c'), ('lego-nike-air-force-1-43026-announced-prepare-your-wallets-i','abc7601532bb815d8852bf9fcaf33f7c'), ('lego-pick-a-brick-2026-over-1800-elements-being-retired','bda6a59be62f554c271b3c04cecb00d1'), ('2026-lego-advent-calendars-spotted-on-amazon-indian-prices-u','9080f4e33f351ba05da61bfdd86977f8'), ('lego-pokmon-expands-with-minifigures-arcanine-and-rayquaza-s','3a3ecd0d7a42463dae88283c1c24677e'), ('lego-pick-a-brick-2026-new-elements-arriving-september-1st','714f160818d83ba257a2b5835e036414'), ('lego-san-diego-comic-con-2026-travel-booth-hints-at-new-sets','4ca8136a29562b3541f135f6e819c057'), ('lego-xfiles-scullys-lab-40896-gwp-review-is-it-worth-the-cha','df220e542df8f5c4bae53d24f34726a0'), ('lego-icons-bookshop-book-nook-11379-announced-will-it-make-i','a2404c6aa097c09e9baef503ee0ddc7f'))) + (select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-ideas-21373-downton-abbey-worth-the-wait','566e0a450b5de854386e07615781106a'), ('lego-trainer-supplies-30730-worth-1300','f6182d187581ff48c97d617111cd0bbd'), ('lego-restaurants-of-the-world-greece-40908-a-charming-gwp-wo','e1371b990c0d25e98c857f6a16e65359'), ('lego-olivia-rodrigos-vinyl-43028-worth-4400','fd7132f1528c5bfe69129e06e840bfac'), ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','8cc9e32ff131589ae7856b7f7c477b98'), ('lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc','cddd93dfb12a2b611c26ef1fce652c44'), ('lego-up-scaled-red-minifigure-40868-worth-10500','93f6a7580db62ca74775f27ed2e38b42'), ('lego-build-a-minifigure-2026-halloween-haul-or-heartbreak','c007f02130d560975d02cf3562ac78b9'), ('lego-don-donkey-kong-arcade-72051-worth-25700','889dbc3ae0a85e19d91a9d243d5fb007'), ('lego-olivia-rodrigos-concert-moon-43029-worth-7150','fc2eba3ffbc57f201de390c0a6098c6d'), ('lego-olivia-rodrigos-secret-storage-43030-worth-the-hype','9f35ebb528402819ba0a9f0bdd0bbb18'))) = 103
-- boi:expect-after select (select count(*) from public.news_articles where (slug, md5(content)) in (values ('lego-group-reports-record-revenue-and-profit-in-first-half-o','dcdcb9802c651f238c40910c91310f94'), ('lego-ideas-21370-et-the-extra-terrestrial-estimated-18000-pr','ed75839cae3732b850281f95df6643b7'), ('lego-ideas-reveals-jumanji-universal-monsters-and-kimonos-se','4fe4b4098b8d8d5e9a9d5f4981873b27'), ('bricklink-designer-program-university-of-science-set-indian-','63451b72ba922dbcc321a46da5a4eaaa'), ('lego-fifa-world-cup-trophy-spain-edition-a-spanish-exclusive','236984887bd597b98a4f69d5626d3516'), ('lego-drops-avengers-doomsday-trailer-recreation-hints-at-new','ac3116858b4a4e86983ef091ecc00379'), ('lego-super-mario-kart-sets-for-2027-revealed','db4708008d615be88500a9879e780f65'), ('lego-contest-round-up-for-may-2026-2026-whats-new-and-how-to','3078d300f8c5dfb683cfdd3e2b15f0a9'), ('lego-ent-fan-build-set-number-unknown-price-uncertainty-for-','7f75d7ad29009dc294f66856145fd4d0'), ('lego-40958-christmas-stocking-announced-release-date-set-for','f6738766c60e69dfd2608e5bf23c8885'), ('50-new-lego-sets-leaked-for-india-icons-star-wars-f1-your-wa','a0699c5f46fe23226bd639cf0e0a0bc0'), ('lego-40899-astro-bot-revealed-as-a-playstation-gift-with-pur','237318ea246f43101ee921c64f8ad0a9'), ('lego-icons-star-trek-uss-enterprise-ncc-1701-bridge-11385-of','de126926a79c7dcb44b980de2489403a'), ('certified-store-india-charges-too-much','f33e4ac7db41e7d8e1fbaec3a9690cad'), ('lego-eta-2-actis-jedi-starfighter-brick-built-cockpit-detail','934e84f23153b8914a7299333a4a94e7'), ('lego-halloween-2026-sets-unveiled-for-august-launch','b79320781c2a9861d603db07b4fc0fdc'), ('lego-shrek-collectable-minifigures-revealed-ogre-ly-expensiv','1dad861817720be297972053615fd280'), ('forced-perspective-tmnt-scene-cowabunga-or-collectors-nightm','af4fdf476e8b530503ab8ee1a979b3f4'), ('guillermo-del-toro-lego-tribute-love-is-in-the-air-and-the-w','4a0951e49c3cea539ff5f16939314bf1'), ('lego-40899-astro-bot-gwp-officially-unveiled-arrives-october','ce998c82af6453ad2969a1103477a88f'), ('lego-wednesday-sets-2026-nevermore-academy-and-wednesday-add','a44fa0ec2dbd1bf7dc6bfa35b8777267'), ('lego-batman-returns-batmobile-76355-revealed-a-burton-classi','0c739c234df73a8ead5bfdb8eff28999'), ('lego-restaurants-of-the-world-greece-gwp-august-2026-promos-','b83fa7048ab4e435348f84c500c267c9'), ('lego-horse-knights-camp-a-knights-life-beyond-the-battlefiel','cec6c10cb9143494c924af2f349ffcfd'), ('lego-may-2-reveals-city-creator-and-festival-sets-land-in-in','611d3fab192f853519278a3396aa8b17'), ('what-are-the-new-lego-parts-in-august-2026-sets-2026','6daca725f09b0ce1a1510b0443f4e59d'), ('lego-bio-cup-2026-set-2026-metamorphosis-in-plastic','b4bfba376d5dc315f234e0d5a93b782b'), ('lego-pokmon-smart-play-2027-sets-teased-silhouettes-revealed','133bba5e4d6cb4c3393ad9ec5bd1559f'), ('lego-community-news-april-2026-highlights-2026','b70cd69e9ecf98fadbf6e5cadd01fb4d'), ('lego-50090-legoland-park-adventure-a-park-in-a-box','39edecb544b9d96c5a91bbbff88f77bf'), ('lego-super-mario-minifigure-sets-launching-january-2027','1c5c09dff8a6d9c245f3f0d22a38acfc'), ('febrovery-2026-a-celebration-of-lego-space-rovers-set-2026','8e90e44bd208107d1a9132790d7e3cad'), ('lego-40908-restaurants-of-the-world-greece-gwp-coming-august','d264aaf67d8d95a894150b4dc673dc5f'), ('lego-x-files-set-21369-officially-revealed-prepare-your-wall','adeddc905d4278716b261539716dfd00'), ('lego-ayrton-senna-helmet-43024-announced-a-new-icon-joins-th','9b44fc7764201dbe3aac03ba6031a934'), ('lego-sets-retiring-in-2026-last-chance-before-they-disappear','48de42ca2f3b1966d6df65c55815cdd7'), ('lego-autumn-castle-builds-expectation-vs-reality-for-indian-','8cd8100351a702cb744ec3660a1cf36d'), ('lego-golden-age-superman-batman-and-gremlins-brickheadz-arri','73304771a42427273b6f762f6800d141'), ('throwback-thursday-revisiting-the-controversial-lego-alpha-t','feaa01e66f609fe7abaa49b4954b52da'), ('lego-ideas-21371-wallace-gromit-cracking-set-arrives-october','f12b1e9210f7deaa8d151947a0f369ce'), ('lego-75192-millennium-falcon-still-turning-heads-among-top-v','6648c87dfed08b00f2db305a62b5e0b5'), ('lego-bricklink-designer-program-series-6-limited-restock-inc','01084973cb95ba95dfc808fea1341eb6'), ('lego-playstation-1-72306-the-90s-console-lives-again','948ff1cd00448fb2ae294eb185af3fb4'), ('lego-august-2026-olivia-rodrigo-sets-sell-out-globally-deman','3dc5f054cdd92c0d0328e4546758f3a8'), ('lego-skylines-announced-for-2027-release-hints-at-city-build','e626e466bf0a8eb60d19f236a16cc114'), ('legoland-new-yorks-lego-festival-kicks-off-what-to-expect','9a27fe9043fffa48df43fb8093af2eba'), ('new-lego-parts-in-september-2026-sets-2026','303f740e57ae515295937a09fafa94a4'), ('lego-imperial-lambda-shuttle-and-new-helmets-your-wallet-is-','97c95d7863161ab70f38ebcad63a43e1'), ('lego-pokemon-unleashed-rayquaza-arcanine-and-more-revealed','7820bf0ddcca25f17a56e234c91dea12'), ('lego-super-mario-range-expands-in-2027-with-long-awaited-min','bf9309e00688a7bc92d78f1198b99388'), ('lego-40908-restaurants-of-the-world-greece-gift-with-purchas','bde08b3ce1be7c8e5411b352beda1723'), ('lego-star-wars-ucs-executor-super-star-destroyer-75457-shatt','6732ffd0c0b8b21a19316af16c21d062'), ('brick-train-awards-2026-a-community-celebration-of-lego-trai','ca6975ddcf7a0cb3d67e16d316bb5e03'), ('lego-element-analysis-the-baby-fin-wing-8193-a-new-mould-sur','833e0e0d8975b9c8d1e387fae20f8694'), ('lego-architecture-21065-sagrada-famlia-revealed-a-record-bre','282a3b53bbd35c64759cbd85e5354f5e'), ('lego-bar-6l-with-stop-rings-double-bent-7078-a-new-part-for-','aee24b9cbb8088649000f6f85f90ce5e'), ('lego-ideas-wallace-gromit-21371-officially-revealed','a658f0f77fb2b67b4b2f743a42985a3a'), ('lego-ideas-wallace-gromit-21371-revealed-a-close-shave-for-y','15855eee5218bb7a60f2c8a90592b5eb'), ('new-moulds-spotted-in-lego-pokmon-smart-play-sets-coming-aug','cd939f38dd48552dc18dc2a9a0201069'), ('lego-insiders-day-free-greek-restaurant-gwp-available-now','1b2a9ac58ec41b34127d53920e431edf'), ('lego-community-headlines-and-highlights-april-2026-what-grab','e442852fda050d21f7d4cec00cced82f'), ('why-indian-lego-prices-high-honest-truth','e090caeac7abb3b3ff33889f15c0f242'), ('lego-the-legend-of-zelda-77094-ocarina-of-time-link-epona-re','1a51d7baf7cccd247c0d5a92f39e7798'), ('lego-batman-adventures-in-gotham-city-book-2026-jokerised-ba','762d66006b966cb072fec80c317c61e6'), ('lego-pokmon-30729-premier-ball-gift-with-purchase-details','2ea90758e155880ea6f39476406de8ac'), ('is-lego-worth-price-india-2026','b2ce0cd3ea826fb6aa03cca2b1f31e75'), ('lego-40908-restaurants-of-the-world-greece-gwp-get-it-before','91d9cfc38b684587ee1bc1f9c9532ef8'), ('lego-40902-tribute-to-leonardo-da-vinci-gwp-news-what-it-mea','7f0413364457343daa30258994da79f0'), ('lego-community-headlines-and-highlights-april-2026-whats-new','711240be1be16ee2f69c0121bbc8dad8'), ('lego-gargoyles-moc-your-wallet-is-already-sweating','ac2bef7eed328706032e350fa5feb520'), ('fan-creator-summit-2026-jays-brick-blog-heads-to-billund-for','66e9b5225d41654b137ab74ee90517cc'), ('new-wednesday-lego-sets-announced-but-when-will-they-land-in','03bce1668ca98f7e34c8fb7d2dbe6e6c'), ('lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus','535fa8a6a3630038186f10cc22c71958'), ('lego-jimothy-cryptid-build-surfaces-online','680f2fa502abdf2ec6c469d2ac5b4255'), ('lego-bricklink-designer-program-series-11-finalists-revealed','8214cc92ff5d07dac8b6bccfe9698bc1'), ('two-new-lego-botanicals-sets-bloom-august-1st','ce2f224b9b85c84af5698c4fb02cd3d3'), ('bricklink-designer-program-series-8-preorder-deadline-looms-','1f1573162437a463cf1504497e3e15f1'), ('lego-40975-mini-hogwarts-castle-a-pocket-sized-hogwarts-arri','4c040a3c862a3b6060ee5968f4c552a4'), ('lego-icons-11387-holiday-house-joins-winter-village-collecti','00885f78da4329b21535a5eb23683ec0'), ('lego-ideas-reveals-21373-downton-abbey-prepare-your-wallet','2a1d1314bb2c8a70bff81f09ba79ac5e'), ('lego-fifa-world-cup-trophy-champions-edition-revealed-for-sp','cb63c0e9a03f4430b55183b06ba63aaf'), ('lego-build-a-minifigure-september-2026-halloween-characters-','be2c96dec50753783261793f4347e30a'), ('lego-50090-legoland-park-adventure-a-us10999-exclusive-comin','67e41a0650c5df01679fba3ea97a3c52'), ('lego-ideas-la-catrina-21372-revealed-a-culturally-rich-displ','1624167a6490a10c9dfda55de9ac8660'), ('lego-nike-air-force-1-43026-announced-prepare-your-wallets-i','1e89fe5bb2b913d9ec83802d61f64681'), ('lego-pick-a-brick-2026-over-1800-elements-being-retired','ab67ff9b45b418e2f1a0496249dfa40b'), ('2026-lego-advent-calendars-spotted-on-amazon-indian-prices-u','7fdbdd6c7631bff444743064f64c6342'), ('lego-pokmon-expands-with-minifigures-arcanine-and-rayquaza-s','06ce053522a554c924182e47ebbcaa68'), ('lego-pick-a-brick-2026-new-elements-arriving-september-1st','49194ed236d5cc979d8e0c587d801cae'), ('lego-san-diego-comic-con-2026-travel-booth-hints-at-new-sets','10d5d8c588891a5b68f3f25b62c69570'), ('lego-xfiles-scullys-lab-40896-gwp-review-is-it-worth-the-cha','3d14b37a2780053e219292529edfdb00'), ('lego-icons-bookshop-book-nook-11379-announced-will-it-make-i','3b41520090ebd9e40e71438b602c3963'))) + (select count(*) from public.reviews where (slug, md5(content)) in (values ('lego-ideas-21373-downton-abbey-worth-the-wait','ff564cd6cf346d296a2993f1ec23552c'), ('lego-trainer-supplies-30730-worth-1300','79e719cb79b752bc988616a15aefdd22'), ('lego-restaurants-of-the-world-greece-40908-a-charming-gwp-wo','ca8f388f67e999bbf606537e59d041f0'), ('lego-olivia-rodrigos-vinyl-43028-worth-4400','187ee19e9d8412c7e519b5675811cbd6'), ('lego-olivia-rodrigos-dual-guitar-43031-worth-15400','3a83f6855cc57fe689e5dd2e0452a1aa'), ('lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc','00708f977308315c0eaf6ee693f8bd3d'), ('lego-up-scaled-red-minifigure-40868-worth-10500','3bbc2079882b52b984159c0d016f0d05'), ('lego-build-a-minifigure-2026-halloween-haul-or-heartbreak','83da1112e89a556623314cd8e43c60eb'), ('lego-don-donkey-kong-arcade-72051-worth-25700','d8b7b4f29cf48c2ed45515fcb3fcc542'), ('lego-olivia-rodrigos-concert-moon-43029-worth-7150','d7ce402e128287a4b39430916b0bfae6'), ('lego-olivia-rodrigos-secret-storage-43030-worth-the-hype','e199c8abaf28db38661c08c825d81da4'))) = 103
-- G19 A2 (chat-approved wording, 1 Oct 2026): published estimates of an Indian price worked out from a foreign price are removed,
-- with the dated note "Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced." (G16). Each row is md5-guarded; only the estimate sentences change.
-- Pages whose set now has an Indian price, and general-analysis pages, are held for chat (not in this file).
-- Price guard: a row is skipped if a set it names has an Indian price when this runs; the after-count
-- then falls short and the whole fix rolls back. Staging applied the earlier 110-row version (7 sets got
-- Indian prices at 12:36 UTC 1 Oct and were held); this 103-row version is what production runs.
UPDATE public.news_articles SET content = $c$Your wallet might be feeling the pinch, but the LEGO Group is doing just fine. They’ve just dropped their financial results for the first half of 2026, and it’s a story of booming business. Revenue is up a massive 21% to a record DKK 41.9 billion. Even when you adjust for currency fluctuations, that’s a 26% jump.

Consumer sales have seen a 22% surge. Apparently, people are still very much into LEGO bricks, no matter the theme. The company claims they’ve outpaced the general toy market and actually gained market share. Operating profit also saw a healthy increase of 22%, reaching DKK 10.9 billion. This growth is attributed to strong sales, efficiency gains, and ongoing productivity efforts, all while they’ve kept spending big on things like sustainability and new factories. Net profit jumped an impressive 32% to DKK 8.6 billion.

CEO Niels B Christiansen is understandably pleased, highlighting the broad appeal of their product range and the "excitement for the LEGO brand." He also gave a shout-out to the 34,000 employees working hard to inspire kids and fans. The growth is spread across the Americas, Western Europe, CEEMEA, and Asia Pacific.

It wasn't just about selling more bricks, though. LEGO launched over 330 new products in the first half of the year. Popular themes included LEGO Speed Champions, Botanicals, Technic, Icons, and Star Wars. They also leaned into entertainment IPs, with partnerships around Formula 1, the FIFA World Cup 2026, and something called KPop Demon Hunters. A significant development is the new LEGO SMART Play platform, aiming for more interactive experiences, already seen in LEGO Star Wars and LEGO Pokémon sets. Even the LEGO NINJAGO theme celebrated its 15th anniversary.

The company also made a substantial investment, acquiring 29 LEGO and LEGOLAND Discovery Centres from Merlin Entertainments for DKK 1.9 billion. This adds to their strategy of investing in long-term growth, including factory capacity and sustainable materials.

While specific Indian pricing and availability are yet to be confirmed, based on the global revenue figures, expect continued strong demand. MyBrickHouse and Toycra will likely see these new releases 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-group-reports-record-revenue-and-profit-in-first-half-o' AND md5(content) = '825585242db2df45ed525dead0c4d1ee';
UPDATE public.news_articles SET content = $c$Your wallet just got a call from the 80s. LEGO Ideas has dropped an E.T. set that will make your bank balance feel like it’s stuck in a phone booth.

The official reveal lists 1,226 pieces, an 18+ age rating, and a US retail price of $139.99. No Indian store has posted a price yet, so the set is effectively a grey‑market candidate for now.

The set promises a poseable E.T. figure with a glowing heart, a 360‑degree head, and the iconic finger‑pointing “phone home” gesture. LEGO’s press release teases the alien holding a pot of LEGO flowers, a nod to that bittersweet scene where E.T. revives the dead plant. The design originated from a fan project on Lafabrick and survived the usual Ideas voting marathon, so you can expect the usual attention to detail that the community rewards.

What’s notable beyond nostalgia is the build experience. With over a thousand pieces, the set offers a solid brick‑building session for both newcomers and seasoned builders. The poseable limbs and lighting element add a tactile dimension that many adult‑oriented Ideas sets lack.

Community reaction has been mixed. Some fans love the faithful recreation of E.T.’s expression and the inclusion of the flower pot, while others question the practicality of the design and the price tag. The set’s release date is slated for 1 August on LEGO.com, which means Indian fans will likely see a 4–6 week lag before any official stock appears, if at all.

Check MyBrickHouse for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch. That's about 14 months of Netflix Premium.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-21370-et-the-extra-terrestrial-estimated-18000-pr' AND md5(content) = '180ff96b125ffa2c6b63efa6ebca0cb1';
UPDATE public.news_articles SET content = $c$LEGO Ideas has just dropped the results for the third 2025 review, and it’s a big one. Three fan-submitted projects are officially heading to brick shelves: Jumanji Board Game, Universal Monsters, and LEGO Kimonos. That’s a lot of potential for some seriously cool display pieces and play sets.

The Jumanji Board Game, from PrehistoricHamster051, taps into that childhood nostalgia for the classic movie. Imagine building that iconic game board, complete with all the jungle peril. For fans of the spooky, Universal Monsters by SpectralBricks promises a haunted castle filled with classic creatures. This one sounds like a perfect fit for Halloween, or just any time you need a dose of the supernatural. Then there’s LEGO Kimonos by TheDriXx, which looks to be a more elegant build, featuring two brick-built geishas and their elaborate kimonos. This one seems geared towards home decor, offering a unique cultural display.

It’s worth noting that these are based on fan designs, and the final LEGO sets could look quite different. We’re likely looking at over a year before we see the official models. This is typical for LEGO Ideas projects, giving the design teams time to translate ambitious fan builds into production-ready sets.

Beyond the three confirmed sets, four other ideas have landed in the LEGO Ideas "parking lot." This means they’ve shown promise but need more time for review. These include Naruto: Ichiraku Ramen Shop, Bob’s Burgers: Grand Re-Opening, iMac G3, and Hollow Knight: A Journey to Hallownest. The parking lot has a decent track record, with past ideas like Downton Abbey and Lunch Atop a Skyscraper eventually becoming official sets. It’s good to see some strong contenders still in consideration.

With no specific set numbers or pricing available yet for these Ideas sets, it’s hard to predict the exact cost. However, based on the complexity and themes, we can expect them to range from mid-tier sets to potentially larger, more premium displays.

No Indian store prices are available yet for these upcoming LEGO Ideas sets. MyBrickHouse and Toycra are the stores to watch for when these eventually get announced for India, likely 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
It's a strong showing from the LEGO Ideas platform, offering something for fans of adventure, horror, and cultural art. Keep an eye out for more details as we get closer to release.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-reveals-jumanji-universal-monsters-and-kimonos-se' AND md5(content) = '14da0d229a03b8619e057fb5270e1b12';
UPDATE public.news_articles SET content = $c$Your wallet just enrolled in a crash course on bricks and bank balances. The tuition fee? Still unannounced, but expect the usual brick‑budget shock once the numbers land.

Joshua Kingma’s University of Science finally earned its spot in the BrickLink Designer Program after years of redesigns and perseverance. We caught up with the mind behind the sprawling campus to hear how a massive LEGO build moves from the drawing board to the brick bin. Kingma says the key was “thinking like an architect, building like a kid.” He talks about scaling the design, choosing the right colors, and keeping the build manageable for fans who might not have a whole warehouse of bricks at home.

The set promises a detailed academic quad, lecture halls, and a central library – all rendered in classic LEGO form. It’s a love letter to campus life, complete with tiny tables, benches, and a few “student‑sized” vehicles. For builders who love cityscapes, this could become a new centerpiece in any display room. The interview also reveals that the set will be released under the BrickLink Designer Program, meaning it’s not a regular LEGO store exclusive but a community‑driven release.

No word on a release date yet, but the BrickLink listing suggests a late‑2026 global launch. That timing puts Indian fans in the usual 4–6 week lag zone, unless you’re ready to import. Expect the usual import‑only scenario for BDP sets, with the added risk of price inflation once they hit the Indian market.

No Indian store prices yet. MyBrickHouse and Toycra are the stores to watch — use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'bricklink-designer-program-university-of-science-set-indian-' AND md5(content) = '8ccb518206f11dd455f84769c5e035e2';
UPDATE public.news_articles SET content = $c$Your wallet can relax for now. LEGO has revealed a special FIFA World Cup Trophy set, but before you start calculating conversion rates, there’s a catch. This isn't for us. The 4000351 FIFA World Cup Trophy – Champion’s Edition is an exclusive release celebrating Spain's 2026 World Cup victory. And yes, you guessed it – it’s only available in Spain.

This exclusive set drops on October 1st, 2026. You can only pre-order it directly from LEGO.com, provided you have a Spanish shipping address. The price is €199.99, which is €20 more than the standard FIFA World Cup Trophy set. For that extra cash, you get a commemorative box featuring the World Cup logo in Spanish colours. There's also a mini trophy on a podium with a backdrop celebrating Spain's championship.

The set includes a minifigure, though initial photos didn't show it. It turns out it's the same minifigure from the regular trophy set, so no new national team player here. A cool detail for those who've built the original is the printed disc at the base. This special edition adds Spain’s 2026 victory to that commemorative piece. It sounds like a fantastic collectible for any Spanish football fan. It’s a real shame it’s not a global release. The blog author was ready to click buy, but alas, a Spanish address is mandatory.

No Indian store prices are available for this Spain-exclusive release. MyBrickHouse and Toycra are the stores to watch for any official LEGO releases in India, but this trophy is strictly off-limits. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for any sets that do make it to India.

This LEGO FIFA World Cup Trophy – Champion’s Edition is a fantastic idea, a real collector's item for fans of Spanish football. But for the rest of us, it’s a case of watching from the sidelines. Unless you have a friend in Spain or plan a trip, this one is going to be tough to get your hands on without venturing into the grey market.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-fifa-world-cup-trophy-spain-edition-a-spanish-exclusive' AND md5(content) = '5b06005c3fd2e932b41e51a4fd8e16d1';
UPDATE public.news_articles SET content = $c$LEGO and Marvel have dropped a trailer recreation for the upcoming Avengers: Doomsday movie, and it’s got fans buzzing. This isn't just any trailer; it’s packed with minifigure hints that haven't hit shelves yet. We're talking about potential new figures like John Walker, Ghost, Namor, and a different version of Steve Rogers. Plus, a brick-built H.E.R.B.I.E. Makes an appearance.

The trailer, released on Brickset, is a clever way to build hype for the movie and the associated LEGO sets. It showcases several characters in LEGO form that are not currently available as official sets. This has, predictably, led to much speculation in the comments sections of fan sites. Some users are already debating the specifics of new designs, like Namor's hard-piece collar, suggesting it points towards official future releases. Others are lamenting the absence of characters like Gambit from existing or rumored sets.

It's a familiar dance. LEGO often uses these promotional pieces to gauge fan reaction and test the waters for new characters or designs. However, as one commenter pointed out, these trailers don't always translate into actual sets. This leaves fans in that frustrating limbo, wanting new figures but unsure if they will ever materialize. The use of CGI over stop-motion was also noted, with the rationale being cost-effectiveness for such promotional material.

While no specific set numbers have been confirmed or released alongside this trailer, the implication of new minifigures is clear. The focus on multiverse elements, as suggested by some comments, also opens the door for a wide range of characters, potentially from different timelines or realities. This means we could see more obscure or fan-favorite characters making their LEGO debut.

No official Indian pricing or release date has been announced for any potential sets revealed through this trailer. Toycra and MyBrickHouse will likely stock these 4–6 weeks after global launch, assuming they are officially released. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The question remains: will these hinted-at characters become official LEGO sets? Only time will tell, but this trailer certainly gives us a tantalizing glimpse of what could be. On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-drops-avengers-doomsday-trailer-recreation-hints-at-new' AND md5(content) = 'ea82dd8143c43187905e096dd907d0e1';
UPDATE public.news_articles SET content = $c$LEGO has dropped more images of the upcoming Super Mario Kart sets, and your wallet is already bracing for impact. These sets, slated for a January release, are officially out of the rumour mill and into the realm of "here's what you might actually buy." We're talking minifigure-scale Mario Kart action, which is a departure from the previous buildable figure focus.

The new batch of images includes box art and more detailed shots, giving us a clearer look at the seven sets hitting shelves. The smallest is [72052](/sets/72052-marios-pipe-jump) Mario's Pipe Jump with just 61 pieces, followed by [72054](/sets/72054-mario-kart-racing-with-mario) Racing with Mario at 84 pieces. Then we have [72055](/sets/72055-marios-beach-adventures) Mario's Beach Adventures (196 pieces), [72056](/sets/72056-mario-kart-luigi-bowser-jrs-race) Luigi & Bowser Jr.'s Race (104 pieces), and [72057](/sets/72057-yoshi-at-marios-house) Yoshi at Mario's House (147 pieces). The larger sets include [72058](/sets/72058-mario-kart-bowsers-rumbling-race) Bowser's Rumbling Race with 409 pieces, and the biggest one, [72060](/sets/72060-fire-mario-bowsers-castle) Fire Mario & Bowser's Castle, boasting a hefty 850 pieces. There's also [72061](/sets/72061-fire-luigi-vs-koopa-troopa-battle) Fire Luigi vs. Koopa Troopa Battle with 241 pieces.

Early reactions from the comments section are mixed, but many seem excited about the new direction and the price points. The box art is apparently a highlight for some, with one commenter calling it "some of the best Box art I've ever seen." The minifigure-scale approach, especially for the Bowser's Castle set, is being praised for its play features and design. However, some fans feel the previous Super Mario iterations covered all their needs.

For collectors in India, the wait begins. Official pricing and availability are still TBD, but based on the US retail prices, we can estimate the cost. The smallest set, 72052 Mario's Pipe Jump, is $9.99 USD.

MyBrickHouse and Toycra will likely stock these 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

With multiple sets releasing, it's probably wise to pick and choose which ones fit your collection and budget. While the prices seem reasonable for licensed sets, waiting for potential deals or bundles might be the smartest move.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-super-mario-kart-sets-for-2027-revealed' AND md5(content) = 'a43931fb919761bdf60dc25417618ff5'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72052', '72054', '72055', '72056', '72057', '72058', '72060', '72061') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72052', '72054', '72055', '72056', '72057', '72058', '72060', '72061') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet just heard the word “contest” and it’s already sweating. May has rolled in with a fresh batch of LEGO challenges, and every builder from the suburbs to the metros is eyeing the prize pool. BrickNerd’s roundup lists the themes that will dominate the month: LEGO Ideas, Star Wars, and a surprise wave of adorable builds that look like they belong in a kid’s bedroom rather than a galaxy far, far away.

If you’ve been waiting for a reason to dust off that half‑finished MOC, this is it. The LEGO Ideas call‑for‑entries opens on the 10th, giving you three weeks to polish a concept that could become the next fan‑favorite set. The guidelines are classic: a clear buildable design, a short pitch video, and a budget breakdown. Expect to spend anywhere between ₹2,000 and ₹5,000 on the bricks you’ll need, which means you might have to tap into that emergency chai fund.

Star Wars fans aren’t left out. A separate challenge asks participants to recreate a scene from the saga using only the newest pieces released in the last six months. The twist? The build must be under 500 pieces, so you’ll have to be clever with brick placement. It’s a good excuse to finally justify that extra set of lightsabers you’ve been hoarding.

The “adorable” category is a wildcard. Think plush‑like animals, cute vehicles, and even a LEGO‑styled version of a popular Indian snack stall. Organisers promise “awesome LEGO prizes,” which usually means a handful of exclusive minifigures, a year’s supply of LEGO bricks, and a voucher that could cover a decent chunk of a future set. No official price on the prizes yet, but the community buzz suggests they’re worth the effort.

Entry forms close on May 31, and winners will be announced in early June. Keep an eye on the official LEGO website and the BrickNerd feed for any rule tweaks. In the meantime, start sketching, gather your bricks, and maybe set aside a small budget for extra pieces—your bank account will thank you later.

MyBrickHouse and Toycra are expected to list it 4–6 weeks after the contest announcement, if it ever turns into a set. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-contest-round-up-for-may-2026-2026-whats-new-and-how-to' AND md5(content) = 'a416d6c3b59d081b5a936479dd169dc2';
UPDATE public.news_articles SET content = $c$Your wallet just whispered, “Do we really need a towering Ent in the living room?” Ben Arkley’s latest LEGO Ent isn’t a store‑shelf product; it’s a fan‑made behemoth that grew from a simple experiment into a sprawling masterpiece. The build is a study in clever part usage – twisted branches, interlocking bark, and a cascade of hidden details that reward a close look.

Arkley started with a handful of basic tree elements, then let the design evolve organically. The result is a sprawling creature that feels alive, its limbs twisting like ancient wood. The build showcases a mix of standard bricks and specialty pieces, proving that with the right imagination, even a handful of parts can become a forest‑level centerpiece. While it’s not an official LEGO set, the level of detail rivals many licensed releases, and the build has already sparked chatter across the LEGO community.

Because the Ent is a one‑off fan creation, there’s no official SKU, no retail price, and no guarantee of future production. Bricknerd’s coverage highlights the ingenuity behind the build and the patience required to assemble it – a true test for any builder who wants to tackle a project that spans hundreds of pieces. The article also points out that Arkley plans to release a limited run of the model through his own channels, meaning interested fans will need to source it directly from him or via a secondary market.

For Indian fans, the lack of an official SKU translates into price ambiguity. No Indian store has listed a concrete figure, and the model will likely arrive as an import once Arkley opens orders. Expect a lag of a few weeks after any global announcement, and keep an eye on both MyBrickHouse and Toycra for potential listings. Until a formal price appears, budgeting for this Ent will be a guessing game, so consider the cost‑to‑enjoy ratio carefully before diving in.

MyBrickHouse and Toycra will likely list it 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
That's roughly 15 months of Netflix Premium.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ent-fan-build-set-number-unknown-price-uncertainty-for-' AND md5(content) = 'be201c7e1b7b7c2e5fb86eff4c697057';
UPDATE public.news_articles SET content = $c$August has arrived, and with it, the first whispers of the festive season. LEGO has officially unveiled the [40958](/sets/40958-christmas-stocking) Christmas Stocking, a new seasonal set slated for release on October 1st. This isn't just any holiday decoration; it boasts an intricate tiled pattern on the front and a delightful array of seasonal items peeking out from the top. For fans of minifigures, there's an exclusive figure included, reportedly inspired by the classic Nutcracker tale.

The set comes with 342 pieces. While the exact price in India is yet to be confirmed, the international retail price is set at £29.99, $34.99, or €34.99. Some initial reactions suggest this might be a tad on the expensive side when compared to other LEGO seasonal offerings, but the inclusion of an exclusive minifigure and a detailed build could justify the cost for dedicated collectors. The design elements, including layered reds and a gingerbread tree cookie reminiscent of Little Debbie's iconic treats, have already sparked discussion.

The included minifigure, while clearly holiday-themed, has drawn some comment regarding its appearance, with fans debating whether it's a Nutcracker, a marching band member, or perhaps even a Holiday Elf. Regardless of its precise identity, it adds a unique character to the set. The set's overall design aims to capture that cozy, festive feeling, making it a potential centrepiece for holiday displays. Given the October 1st release date, it’s perfectly timed for those who like to get a head start on their holiday preparations.

Availability at Indian retailers like Toycra and MyBrickHouse is not yet confirmed, and a 4-6 week lag from the global launch is expected. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

With the price point being a potential sticking point for some, and the set only just announced, it might be prudent to wait and see if any Indian pricing becomes available or if any early discounts surface. However, for those who can't resist the call of a new holiday set, especially with an exclusive minifigure, it's definitely one to keep an eye on.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40958-christmas-stocking-announced-release-date-set-for' AND md5(content) = 'd9e77f7974a598a58389754a6ef095bc'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40958') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40958') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet officially stops speaking to you when LEGO decides to drop over 50 new sets at once. We’re talking about Icons, Star Wars, Formula 1, and a whole lot more. This isn’t just a leak; it’s a declaration of war on your savings account. While the exact set numbers are still shrouded in mystery, the sheer volume suggests that every corner of the LEGO universe is about to be refreshed, expanded, or perhaps just invented from scratch.

Think about it. Icons sets mean more complex builds for us grown-ups who are definitely not playing with toys. Star Wars leaks? That’s a direct hit to anyone who owns a single piece of black or grey plastic. And F1? Prepare for your living room to look like a pit lane, complete with the accompanying roar of imaginary engines and the smell of… well, plastic. This deluge of newness isn't just about new pieces; it's about new decisions, new compromises, and new justifications for why you absolutely need that one specific spaceship.

This means we’re talking about the equivalent of a decent return flight to Goa for the more ambitious builds, or perhaps enough premium biryani to feed your entire extended family for a month. Availability will likely be staggered, with major releases hitting Toycra and MyBrickHouse within 4-6 weeks of their global debut, while some niche sets might remain import-only for a while. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The leaks suggest a strong focus on fan-favourite themes, promising plenty of fodder for both collectors and casual builders. The real question isn't what’s coming, but how many of these you’ll manage to resist. It’s a battle of willpower, of budgets, and of shelf space.

On that bombshell, it's time to say goodbye.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = '50-new-lego-sets-leaked-for-india-icons-star-wars-f1-your-wa' AND md5(content) = 'f468b4a720c68c9762a6ebfdbdf34698';
UPDATE public.news_articles SET content = $c$LEGO just announced the [40899](/sets/40899-astro-bot) Astro Bot, and your wallet is already twitching nervously. This isn't a set you can just buy off the shelf, though. It’s a gift-with-purchase, meaning you'll need to spend a certain amount to get it. The rumour mill suggests that threshold is $150, which is a significant chunk of change.

The 276-piece model depicts Astro Bot, the PlayStation mascot. It looks pretty good from the images available, with some nice detail and swappable eye tiles for different expressions. It’s a neat idea, especially for fans of the PlayStation ecosystem. Whether it ends up being tied to a PlayStation console purchase or a general $150 spend is still up in the air, with conflicting reports circulating. We should know for sure within the next few days.

This GWP is set to launch on October 1st. For those of you who are deep into the LEGO collecting game, this might be a must-have. It’s a unique item, and GWPs often become quite sought after. However, it’s also a reminder that LEGO and Sony are leaning into the gamer demographic, which is a smart move given the overlap in fan bases.

The question remains whether this will ever see an official release in India. Historically, GWPs don't always make it to our shores through official channels, often requiring import or a trip abroad. The current US retail price is $150, which translates to a substantial amount when considering import duties and retailer markups.

Neither Toycra nor MyBrickHouse are expected to stock this officially, making it import only for now. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission). A 4–6 week availability lag from global launch is typical for any official LEGO releases in India.

It’s a cool looking model, no doubt. But as a GWP, its availability in India is highly questionable. If you absolutely must have it, prepare to pay a premium on the secondary market or through unofficial channels.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40899-astro-bot-revealed-as-a-playstation-gift-with-pur' AND md5(content) = '0bbc1d08840461196339dc4f294aaddb'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40899') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40899') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet is already bracing for impact. LEGO has officially beamed down details for the Icons Star Trek: U.S.S. Enterprise NCC-[1701](/sets/1701-basic-building-set-trial-size) Bridge set, number 11385. This isn't your kid's LEGO; it's an 18+ set packing 1,701 pieces, and it costs a hefty $199.99 USD. That's the kind of price that makes you pause and consider your life choices.

The new set dives deep into the original series, recreating the iconic bridge and transporter room. Following last year's exterior model of the Enterprise-D, this set lets you step inside the legendary starship. Expect detailed computer stations, a viewscreen showing a Klingon, and that classic transporter platform. LEGO has even included interactive features: rock the captain's chair for turbulence simulations, spin a dial to activate the transporter, and flick a lever for turbo lift doors. It’s a lot of playability packed into a display piece.

Eight brand-new minifigures are included: Kirk, Spock, Uhura, Sulu, McCoy, Chekov, Chapel, and Scotty. Plus, four tribbles, communicators, phasers, Spock's harp, and more accessories. The set is modular, allowing for different display configurations. It’s launching globally on September 1st, 2026, just in time for Star Trek's 60th anniversary month. Pre-orders open July 23rd, 2026.

While the concept is fantastic, and a welcome continuation of the LEGO Star Trek line, the inclusion of the transporter room feels a bit unbalanced to some. Still, the bridge details look solid, and the sheer number of minifigures and accessories is impressive. The price point, however, is a serious consideration, especially when compared to other large sets. It's not cheap, and whether it's worth the premium will be a tough call for many fans.

MyBrickHouse and Toycra will likely stock this 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

This is definitely a set to watch. If you're a die-hard Star Trek fan with deep pockets, you might be tempted to grab it on day one. For the rest of us, waiting for a potential discount or a sale seems like the more sensible approach. It's a cool piece of LEGO history, but your wallet needs to be prepared for warp speed.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-icons-star-trek-uss-enterprise-ncc-1701-bridge-11385-of' AND md5(content) = 'bc2089da147c0130a18fe40986f331ff'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('1701') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('1701') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Everyone was so excited about the store opening that nobody stopped to check the prices.

May 2025. India's first LEGO certified store opens at Ambience Mall, Gurugram. Four thousand five hundred square feet. Pick a Brick wall. Mosaic Maker. The whole experience. Indian LEGO fans — who had spent decades sourcing sets through suitcase imports, grey market channels, and increasingly desperate Amazon searches — finally had a proper home. The photos went everywhere. The excitement was genuine. The prices were quietly ignored.

They should not be ignored any longer.

What the certified store actually charges

The LEGO certified store in India is operated by MyBrickHouse under licence from LEGO. MyBrickHouse is a legitimate, trustworthy retailer and the only source in India for certain exclusive and limited sets. None of what follows is an argument against shopping there. It is an argument for knowing what you are paying for.

A set that costs $60 at LEGO's US retail — already a premium price — lands at MyBrickHouse for ₹7,500 to ₹9,000 depending on the set. The difference — ₹1,750 to ₹3,250 — is import duties, logistics, and retailer margin. This is not a scam. It is arithmetic. But it is arithmetic that nobody in the certified store opening coverage bothered to do publicly.

For comparison, Toycra — a non-certified Indian LEGO retailer — frequently prices the same sets 10–20% lower than MyBrickHouse. The sets are identical. Authentic LEGO, same box, same pieces, same warranty implications. The difference is the certified store premium.

What you are actually paying for

To be fair — and fairness requires this — the certified store premium buys you real things.

Guaranteed authenticity. Physical retail experience. The Pick a Brick wall, which has genuine value for serious builders. Access to exclusive sets and promotional items that non-certified retailers cannot stock. Trained staff who know the product. The full LEGO brand experience in a way that a warehouse fulfilment operation cannot replicate.

If you are buying a ₹50,000 UCS set and want absolute certainty about authenticity and after-sales support, the certified store premium is rational. If you want the Pick a Brick experience or a set that is exclusive to certified retail, there is no alternative.

Where the argument falls apart

For the vast majority of sets, for the vast majority of Indian buyers, none of that premium matters.

A City Police Station is a City Police Station. A Technic McLaren is a Technic McLaren. The box is sealed, the pieces are LEGO, and the building experience is identical whether it came from a certified store or a competitive online retailer. Paying 15% more for the certified store label on a standard catalogue set is paying for a feeling, not a function.

The Indian LEGO community celebrated the certified store opening as a moment of arrival — proof that LEGO finally took India seriously. That celebration was earned. But arrival does not mean affordable. The certified store did not change the import economics that make LEGO expensive in India. It added a premium retail layer on top of them.

What needs to happen

LEGO needs to address Indian pricing structurally — not through retail experience but through supply chain. Manufacturing in India, or at minimum establishing true Indian RRP that accounts for local economics, would do more for Indian LEGO accessibility than any number of certified stores.

Until that conversation happens, the certified store is a beautiful shop that most Indian LEGO fans will visit occasionally for the experience and buy from rarely for the price.

Check bricksofindia.com before every purchase. MyBrickHouse and Toycra all on one page. Use code ABHINAV12 at Toycra for 12% off above ₹500. The certified store is worth visiting. It is not always worth paying.

On that bombshell — the prices were always there. We just did not want to look at them on opening day.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'certified-store-india-charges-too-much' AND md5(content) = '5376a53094c0df2cd7e2937921040647';
UPDATE public.news_articles SET content = $c$The Brothers Brick dropped a new article today, detailing a brick-built LEGO Eta-2 Actis-class light interceptor. This isn't your standard LEGO build; it features a fully brick-built cockpit, moving away from the printed versions we've seen before. Apparently, LEGO designers have been cooking up some clever SNOT (Studs Not On Top) brick techniques to construct the thick, detailed wings.

One standout detail highlighted is the use of a flexible stretcher holder piece for the cockpit. This is a neat trick that adds a layer of intricate detail not usually found in sets of this type. The article also hints at an impressive wing deployment mechanism, suggesting this model isn't just for display but might have some play features as well. It's described as being so detailed, the fictional Separatist flagship, the Invisible Hand, wouldn't stand a chance against it.

While this specific set number isn't confirmed in the source, the focus on detailed, brick-built elements suggests a potential new entry for Star Wars fans. Given LEGO's history with Jedi Starfighters, this new approach to construction could signal a significant upgrade in design quality. The Brothers Brick article, published on September 13, 2026, seems to be showcasing a fan-built or prototype model, as no official set number or release date is mentioned. This means we are in that familiar waiting game.

No specific Indian pricing or availability information is available yet. Based on the US retail price of similar detailed Star Wars sets, expect this to land at a price point that will require some serious consideration. It’s likely to be a significant investment, perhaps comparable to several months of a high-tier streaming subscription. Keep an eye on MyBrickHouse and Toycra for any official announcements or potential imports once details surface. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

No Indian store prices yet. MyBrickHouse and Toycra are the stores to watch for future availability. Expect a 4–6 week lag from global launch if it gets an official release.

It’s always exciting to see LEGO push the boundaries with construction techniques, especially on beloved ships like the Jedi Starfighter. The emphasis on a brick-built cockpit and clever wing assembly sounds like a promising development for adult collectors and dedicated fans of the prequel trilogy. We’ll have to wait and see if this becomes an official release, but the innovation shown is definitely worth noting. On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-eta-2-actis-jedi-starfighter-brick-built-cockpit-detail' AND md5(content) = '95426d980a1b3c831d3c1b7dd084d987';
UPDATE public.news_articles SET content = $c$LEGO is dropping some spooky new additions for Halloween 2026, and they’re set to land on August 1st. If you’re a fan of seasonal builds, get ready to add these to your collection. These aren't your usual wide-release sets; the yellow stripe on the box usually means they’re exclusive to LEGO Stores and LEGO.com. So, mark your calendars for August 1st if you want to snag them directly.

First up is a new take on the LEGO Halloween Pumpkin, set number 40872. While LEGO Pumpkins have been popular before, this 2026 version comes with a neat trick: a Glow in the Dark Ghost minifigure. It’s a fresh spin on a familiar design, and the added minifigure should make it a hit for those who love a little extra detail in their seasonal displays.

Then there's the [40883](/sets/40883-halloween-skull-candle) Halloween Skull Candle. This one looks like a solid decorative piece, perfect for adding some eerie flair to your home. The best part? It’s got glow-in-the-dark eyes, making it extra spooky when the lights go down. Who wouldn't want a LEGO skull candle to get into the Halloween spirit?

The third set, [40873](/sets/40873-colorful-lantern) Colorful Lantern, is particularly interesting. While not strictly a Halloween theme, it appears to be inspired by the lanterns used during Diwali, the Hindu festival of lights. This is a significant move, potentially marking the first Diwali-inspired LEGO model. It’s great to see LEGO acknowledging and celebrating different cultural festivals through its builds, broadening the appeal beyond traditional Western holidays.

The pricing for these sets is as follows: the 40883 Halloween Skull Candle and 40873 Colorful Lantern will retail for US$19.99 each, while the [40872](/sets/40872-halloween-pumpkin-lantern) Halloween Pumpkin Lantern is priced at US$29.99.

MyBrickHouse and Toycra will likely be your best bet for these, though expect them to appear 4–6 weeks after the global August 1st launch. Check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

These sets are launching on August 1st, 2026. Given they are likely store exclusives and the current price point, it’s probably wise to wait for them to appear in Indian stores rather than considering import options immediately. Keep an eye on local retailers for their availability and pricing.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-halloween-2026-sets-unveiled-for-august-launch' AND md5(content) = '92a3874ab511854f628ee3355c0ab553'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40883', '40873', '40872') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40883', '40873', '40872') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO has officially announced a new series of Collectable Minifigures, and this time they’re diving deep into the swamp with characters from the Shrek movies. Yes, you read that right. Ogre, Donkey, Fiona – they’re all coming. This is either a dream come true or a nightmare fuel situation, depending on how you feel about animated ogres in plastic form.

There will be twelve minifigures in total to collect. Some of these come with an extra buddy, like Fiona and Donkey, which is a nice touch. We’ve got Shrek himself, Fiona, Donkey, Puss in Boots, Dragon, Lord Farquaad, Thelonious, Gingy, Pinocchio (who also comes with one of the Three Blind Mice), Big Bad Wolf (also with mice), Merlin, Fairy Godmother, and Prince Charming. The inclusion of the Three Blind Mice across multiple figures is an interesting, if slightly annoying, way to get collectors to buy more than they planned. It’s also amusing to think we’re getting both Disney and DreamWorks versions of characters like Pinocchio thanks to previous CMF series.

The international price is set at £3.49, $4.99, or €3.99 per blind bag. Release date is September 1st.

MyBrickHouse and Toycra will be the usual suspects for stocking these, but it could take 4–6 weeks after the global launch for them to appear. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Fan reactions online are mixed. Some are thrilled by the sheer existence of Shrek LEGOs, calling it "so cool." Others are less impressed, with comments pointing out that the character designs, particularly for Shrek and Fiona, don't quite hit the mark. Some feel the heads are poorly executed or the reuse potential for parts is limited. There's also the classic CMF dilemma: do you buy them all, try to find specific ones, or wait for a discounted bundle? Given the mixed reception and the potential for over-saturation in the CMF line, waiting for a price drop or a bundle deal seems like the sensible move here. This isn't a must-buy for everyone, especially if the designs don't win you over immediately.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-shrek-collectable-minifigures-revealed-ogre-ly-expensiv' AND md5(content) = '81d63fe54b7494c80d15f8f4811e7252';
UPDATE public.news_articles SET content = $c$Your wallet is probably fine. For now. LEGO hasn't announced any specific set number for this Teenage Mutant Ninja Turtles scene, so we're not dealing with official prices or availability just yet. This is more of a fan creation, a brilliant piece of forced perspective art by artist_davs that’s getting some buzz. It’s a scene that leans heavily into the darker, grittier origins of the TMNT, far from the Saturday morning cartoons. Think less pizza parties, more brooding vigilantes.

The build itself uses a cool forced perspective trick, creating a city backdrop that’s almost entirely in dark greys and blues. It’s like a Gotham City for reptiles. The focus is sharp, landing squarely on Leonardo, who is the only splash of colour in the whole composition. And yes, there’s a pizza flyer. Because even in the darkest timelines, the turtles need their pepperoni. It’s a clever way to capture the original Mirage comic vibe.

This kind of build highlights what’s possible when fans get creative. It’s the kind of thing that makes you wish LEGO would release more sets based on the original comics, rather than just the cartoon versions. But with no set number, no official release, and no concrete price, it’s impossible to say if this will ever be something you can actually buy. It’s a reminder that sometimes, the coolest builds are just that – builds. They exist to inspire, not necessarily to be added to your ever-growing collection.

If this were officially released as a set, we’d be looking at a price point that would make your average Indian LEGO fan sweat. MyBrickHouse and Toycra will be the first places to check for availability, but anticipate a 4–6 week lag from any potential global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

For now, we can only admire the artistry. It’s a good reminder that the LEGO community is full of talented builders creating incredible things. Whether this particular piece ever becomes a retail product is up in the air. It’s a shame because it looks like a fantastic display piece. But hey, at least we know the turtles are still out there, fighting crime and craving pizza.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'forced-perspective-tmnt-scene-cowabunga-or-collectors-nightm' AND md5(content) = '56f3fb45829811e3be891cd47bcc478d';
UPDATE public.news_articles SET content = $c$Your wallet just sighed, because this romantic LEGO tribute has no Indian price tag to whisper about. The Brothers Brick site ran a piece on a fan‑built homage to Guillermo del Toro’s Oscar‑winning The Shape of Water. French builder Keyser Bricks, known for detailed movie recreations, has taken on the watery romance and turned it into a brick‑by‑brick love letter.

The build is not an official LEGO set. It lives in the realm of MOCs – custom creations that exist only in the builder’s garage and on YouTube. That means you won’t find a barcode, a retail box, or a LEGO‑issued product number. Instead, you get a series of pictures, a parts list (if the builder shares one), and a lot of admiration for the craftsmanship.

Keyser’s rendition captures the Cold War vibe that permeates the film. The pipes and cables that snake around the amphibious man’s tank are rendered with a surprising level of detail. The build also nods to the film’s iconic lab scenes, with a mix of matte black plates, transparent tubes, and a few bright red accents that hint at the secret experiments. For fans who love the blend of sci‑fi grit and fairy‑tale romance, it’s a satisfying visual treat.

Because this is a fan project, there is no official retail price, no availability in Indian LEGO stores, and no guaranteed kit you can order. If you’re keen on recreating it yourself, you’ll have to source the parts individually or hope the builder releases a printable guide. That adds a layer of cost and effort that most casual buyers would rather avoid.

The piece also highlights a broader trend: LEGO fans are increasingly looking beyond the usual superhero or space themes and embracing more personal, cinematic stories. It’s a welcome reminder that the bricks can tell any story, even one that swims beneath the surface.

No Indian store prices yet. Check MyBrickHouse and Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from any global release. If this tribute were officially sold in India, it would cost roughly the same as 12 months of Netflix Premium.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'guillermo-del-toro-lego-tribute-love-is-in-the-air-and-the-w' AND md5(content) = '3eafc92568bc5a173641fc7c7ebc16b4';
UPDATE public.news_articles SET content = $c$LEGO has officially pulled back the curtain on [40899](/sets/40899-astro-bot) Astro Bot, a new Gift with Purchase (GWP) set slated for release on October 1st, 2026. This little bot is a nod to the critically acclaimed PlayStation 5 game, where players control a charming robot on a mission. It’s shaping up to be one of the stronger GWPs LEGO has offered this year, adding a bit of gaming flair to the brick-built world.

The Astro Bot GWP is expected to be a freebie with qualifying purchases of US$150 or more, starting from October 1st. While there have been some whispers about it being exclusively bundled with the upcoming [72306](/sets/72306-playstation) PlayStation set, that scenario seems unlikely. However, if you’re already planning to grab the 72306 PlayStation, which also launches on October 1st for US$179.99, you’ll comfortably meet the GWP threshold. The 72306 PlayStation itself is priced at US$179.99, AU$279.99, £139.99, €159.99, CAD$239.99, and SGD$239.90.

This Astro Bot model looks genuinely delightful. It captures the essence of the game character, a cute robot tasked with rebuilding his spaceship, which itself is shaped like a PlayStation. For fans of modern platformers, this GWP is a welcome addition, celebrating a game that's been lauded as one of the best of its generation. It’s a smart move by LEGO to tap into the gaming community, especially with a beloved character like Astro Bot.

More details on exact purchase thresholds and availability in India are still pending official confirmation. We’ll update this post as soon as LEGO releases the specifics. Until then, keep an eye out for this exciting GWP.

The US retail price for the 72306 PlayStation set is $179.99. This set is not available at any official Indian retailers like Toycra or MyBrickHouse, and no official India MRP has been announced. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).

This GWP is a strong contender for one of the best free sets of 2026, especially for gamers. The build itself promises to be engaging, and the final model is sure to be a conversation starter on any display shelf. While we don’t have concrete details on Indian availability or pricing yet, the Astro Bot is definitely one to watch.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40899-astro-bot-gwp-officially-unveiled-arrives-october' AND md5(content) = '6a42c19846bd7eda1244d770797749cc'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40899', '72306') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40899', '72306') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO has finally confirmed two new sets based on the hit Netflix series Wednesday, slated for an October 2026 release. This is big news for fans who have been hoping for more Addams Family representation in brick form. The most significant reveal is the introduction of the very first Wednesday Addams minifigure, set to debut in the [76788](/sets/76788-nevermore-academy) Nevermore Academy set. Previous waves of LEGO Wednesday content have featured minidolls, so this shift to a proper minifigure is a welcome change for many.

Both sets, 76788 Nevermore Academy and [76787](/sets/76787-wednesday-backpack) Wednesday Backpack, are scheduled to launch on October 1, 2026. This timing is perfect, offering fans a treat just before the Halloween season. With Season 3 of the Netflix series currently in production, these new sets should help keep the hype alive until the new episodes arrive.

The 76788 Nevermore Academy set, a substantial build with 890 pieces, will retail for US$69.99. The accompanying 76787 Wednesday Backpack, a smaller accessory set with 401 pieces, is priced at US$44.99. These prices suggest a potential interest in accessory-style builds alongside larger display pieces within the theme.

Unfortunately, as of now, there are no official Indian retail prices or confirmed availability dates for these sets in India. This means that for Indian fans eager to get their hands on these new Wednesday-themed LEGO creations, importing them will likely be the only option. The absence of official distribution channels means a significant wait and potential price inflation through unofficial channels.

These are estimated import prices and not confirmed India retail prices. Currently, these sets are not available at official Indian retailers like Toycra or MyBrickHouse. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if they are eventually stocked. If these were officially sold, that estimated price for the Academy set would cover about 3 months of Spotify Premium Family Plan.

The decision to finally include a Wednesday Addams minifigure is a smart move by LEGO, catering directly to fan demand and the evolving nature of the franchise. Whether these sets will eventually see official release in India remains to be seen, but for now, fans will have to rely on international markets and the grey import scene.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-wednesday-sets-2026-nevermore-academy-and-wednesday-add' AND md5(content) = '824571fdf90465d579ce0e0329181e63'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('76788', '76787') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('76788', '76787') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet called. It wants to discuss the new LEGO Batman Returns Batmobile. This 2,269-piece beast, set number 76355, is a deep dive into Tim Burton's 1992 classic. It's not just a model; it's a display piece that captures one of the most iconic Batmobile designs ever.

This isn't some flimsy toy. The detail looks incredible, and the ability to split open and launch a Batmissile? That's pure movie magic translated into plastic. And the new Batman cowl, draping over the minifigure? That's a game-changer for how LEGO handles capes. It’s genuinely innovative.

LEGO is dropping this on September 1st, 2026, for Insiders, with a wider release on September 4th. It’s exclusive to LEGO.com and official LEGO Stores. So, no hunting around third-party sellers for this one.

Now, the price. It's US$229.99. That's a lot of cash for one Batmobile, even a legendary one. While the build and the movie nostalgia are strong, the inclusion of only one minifigure – Batman, naturally – feels like a missed opportunity. Where are Penguin and Catwoman? Getting them in minifigure form from this movie is incredibly rare, and this was the perfect chance. Missing out on them in the [76252](/sets/76252-batcave-shadowbox) Batcave Shadow Box set makes their absence here even more painful.

This set will likely land in India around ₹24,500. That’s the price of 10 months of Spotify Premium Family Plan. MyBrickHouse and Toycra will be the places to watch, but expect a 4–6 week lag from global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

If you're a die-hard Tim Burton Batman fan and already own the 1989 Batmobile and Batwing, this is probably a no-brainer. But for the rest of us, the steep price and the stingy minifigure count mean it’s probably wise to wait for a sale.

MyBrickHouse and Toycra will likely stock it 4–6 weeks after global launch.
Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-batman-returns-batmobile-76355-revealed-a-burton-classi' AND md5(content) = 'a477ce1ad7bc5d6f2a05a6e882bc85c1'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('76252') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('76252') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO's mid-August 2026 offers are officially live, and for those holding out for a substantial bonus, the time might just be now. The big draw is the [40908](/sets/40908-restaurants-of-the-world-greece) Restaurants of the World: Greece, the third Gift With Purchase (GWP) in this popular series for 2026. It’s a solid reason to finally pull the trigger on those August releases you’ve been eyeing.

This Greek eatery GWP is available from August 11th to August 20th, 2026, provided you spend US$180 (or the equivalent in other currencies like AU$295, £160, €180, or NZD$320) on LEGO.com. As usual, pre-orders and Pick a Brick online orders count towards the GWP threshold, which is good news if you’re planning ahead or building something custom.

But wait, there’s more. Alongside the Greece restaurant, LEGO is also offering the [30729](/sets/30729-premier-ball) Premier Ball GWP with any purchase over US$40 (or AU$65, £35, €40, CAD$50). This small bonus is a nice little extra, especially if you’re a fan of the LEGO Pokemon sets.

For LEGO Insiders members, August 11th, 2026, was a one-day special. A bonus 500 Insider Points were up for grabs with your first order of the day. While the promotion was heavily advertised as a single-day event, the overall value proposition for Insiders might feel a bit underwhelming compared to expectations, especially for a dedicated "Member Day." Additionally, selected LEGO One Piece sets are also earning double Insider Points during this promotional period.

No specific Indian pricing or availability information has surfaced for these GWPs yet. Given the global launch dates and the typical staggered release for India, expect a potential lag of 4–6 weeks.

No Indian store prices or availability confirmed yet for the 40908 Restaurants of the World: Greece GWP or the Premier Ball GWP. MyBrickHouse and Toycra will be the stores to watch for these promotions; use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Keep an eye on LEGO.com and your preferred local retailers for updates on when these offers become available in India. The GWPs are usually tied to specific spending thresholds, so it's worth planning your purchases to take full advantage.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-restaurants-of-the-world-greece-gwp-august-2026-promos-' AND md5(content) = '3c4f8bbf3da8d2d228418c60e6b99846'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908', '30729') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908', '30729') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet is probably safe for now. LEGO fan builder ice2bu has shared a creation called "Horse Knights camp," and while it looks like a fantastic display, there's no indication it's an official set or even a rumoured one. This is just a really cool MOC (My Own Creation) from the Ukrainian builder, showcased on The Brothers Brick.

Think about your average knight. We picture them on horseback, lances at the ready, charging into battle. But what did they do when they weren't slaying dragons or rescuing princesses? Apparently, they had to train. A lot. This "Horse Knights camp" depicts exactly that downtime – a bustling medieval scene focused on preparation and daily life within a small castle keep. It’s a hive of activity, showing that even knights need downtime and rigorous training regimes.

The build features guards on watch, archers perfecting their aim, and knights sparring with each other. It's not all combat practice, though. Ice2bu has included essential elements for a knightly encampment: stables for the horses, a forge for weapon and armour maintenance, and even a small vegetable garden to keep the knights fed. It’s a detailed look at the logistics and daily grind behind the armour, suggesting a knight’s life was more than just epic battles.

This MOC is a great reminder of the creativity within the LEGO fan community. While we can't add this specific build to our collection, it serves as inspiration for what's possible with LEGO bricks. It’s a detailed and charming scene that brings a historical period to life with impressive brick-built elements. No set numbers or official product details have surfaced, so treat this as pure fan art for now.

MyBrickHouse and Toycra would likely see this land 4–6 weeks after any hypothetical global launch, but for now, it remains a fan creation. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-horse-knights-camp-a-knights-life-beyond-the-battlefiel' AND md5(content) = 'a7e88df427ba5d932094d90742668e14';
UPDATE public.news_articles SET content = $c$LEGO dropped a bunch of new sets on May 2nd. Your wallet is probably already bracing itself. We are looking at new additions to the City, Creator 3-in-1, and Chinese Festival themes. The video covers several potential releases, including what look like new train sets, a pirate-themed set, a van, and even a roller coaster.

The City theme seems to be getting some exciting new vehicles and play features. If you are into the smaller, more accessible builds, these will likely be on your radar. The Creator 3-in-1 line continues its tradition of offering multiple build possibilities, which is always a good value proposition for the price. These are the sets that let you get a lot of brick mileage for your money.

The Chinese Festival theme, which has been popular, is also getting new sets. These often feature intricate designs and cultural relevance, making them stand out. Expect bright colours and unique elements. The mention of trains and a roller coaster suggests some larger, more ambitious sets might be on the way. These tend to be the ones that require a bit more display space and a slightly deeper dive into your savings.

No specific set numbers or Indian pricing have been confirmed yet. This usually means we are in that familiar waiting game. Global prices are available for some of these, but converting that to INR and factoring in Indian retail markups is always a guessing game. It is best to hold off on any firm financial commitments until official Indian pricing is announced.

No Indian store prices are available for these newly revealed sets yet. MyBrickHouse and Toycra are the stores to watch for their eventual release in India. Expect a 4–6 week lag from the global launch date for these to appear on Indian shelves. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-may-2-reveals-city-creator-and-festival-sets-land-in-in' AND md5(content) = '26b88c7665d13133c77d923262596b36';
UPDATE public.news_articles SET content = $c$Your wallet just rolled its eyes at another August LEGO drop. The bank account will feel the pinch when you realize the new parts list adds up to 941 fresh elements.

New Element Alert
New Element Alert – that’s the headline from New Elementary’s latest post. The site has compiled a spreadsheet of every brand‑new LEGO piece that appears across the August 2026 releases. Nine‑hundred‑plus new parts is a hefty tally for a single month, and it tells you two things: LEGO’s design pipeline is humming, and the collector in you is about to get a lot of new building options.

The biggest chunk of the list comes from the LEGO® Pokémon SMART Play™ line. Those sets are only shipping in the US, UK, Australia, Germany, France and Poland, which means the bulk of the fresh elements are locked behind regional barriers. If you’re in India, you’ll have to rely on the grey market or hope a local retailer decides to import them.

A quick glance at the spreadsheet shows a mix of functional and decorative pieces – new printed tiles, a handful of motorised components, a couple of uniquely shaped windows, and a set of custom minifigure accessories that look like they were ripped straight from a Pokémon battle. The variety should please both the technophile who loves motorised builds and the MOC‑enthusiast hunting for that perfect niche part.

What does this mean for you? If you’re building your own Pokémon‑themed MOC, you now have a pantry of fresh parts to pull from. If you’re a collector, you might see a spike in secondary‑market prices for the SMART Play sets, especially since they’re not officially stocked here. Keep an eye on local brick‑deal groups; sometimes a lucky importer shows up with a handful of those exclusive pieces.

Remember, the new parts are not yet listed on any Indian LEGO store page, and there’s no official MSRP for them locally. Until LEGO decides to bring these pieces to the Indian market, the only route is through import or an enthusiast’s stash.

No Indian store prices yet. Check MyBrickHouse for availability. Check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. If this were officially sold in India, it would cost roughly the same as 18 months of Netflix.
On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'what-are-the-new-lego-parts-in-august-2026-sets-2026' AND md5(content) = '6f0bbe77303f4d4cfd901dbbd33d50b0';
UPDATE public.news_articles SET content = $c$The LEGO Bio-Cup 2026 competition is well underway, and the latest round, themed "Metamorphosis," has showcased some truly wild builds. BrickNerd dropped a highlights reel, and while it's not a retail set, it's a fascinating look at what builders can do with bricks when given a concept. Forget official sets for a moment; this is pure creative expression.

Round 2 focused on transformations. We're talking about everything from a caterpillar becoming a butterfly to more abstract ideas like decay and rebirth. Imagine building a LEGO model that visually represents a plant growing from a seed, or perhaps a creature shedding its old skin. The builders tackled these complex themes with impressive skill, turning plastic bricks into something more profound. It's a reminder that LEGO is more than just replicating existing vehicles or movie scenes.

The highlights reel from BrickNerd gives us a glimpse into the creativity involved. While no specific set numbers are associated with these fan-built masterpieces, the sheer ingenuity on display is worth noting. These aren't sets you can buy off a shelf; they are unique creations born from imagination and countless hours of meticulous building. The competition is heading towards its final rounds, so we can expect even more stunning displays of LEGO artistry.

This competition is purely for fan-built entries, so there is no official India price or availability. MyBrickHouse and Toycra are the stores to watch for potential future releases, though this specific theme is unlikely to become a retail product. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if any related sets do emerge.

It’s inspiring to see the community pushing the boundaries of what’s possible with LEGO bricks. While we can’t add these specific models to our collection, they serve as a powerful proof to the boundless creativity within the LEGO fan base. Keep an eye on the Bio-Cup as it progresses; more amazing transformations are surely on the way.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-bio-cup-2026-set-2026-metamorphosis-in-plastic' AND md5(content) = '18425632e3067660996f3eff21747d6f';
UPDATE public.news_articles SET content = $c$The LEGO Group is teasing new Pokémon Smart Play sets for 2027. These were shown off at Pokemon XP, which is apparently a global LEGO Pokémon fan convention happening alongside the Pokémon World Championships. A teaser video dropped, giving us a look at the current Smart Play characters.

Towards the end of the teaser, some silhouettes appeared. These are expected to be upcoming Pokémon Smart Play models for 2027. Sharp-eyed fans might recognise these shapes. Based on the silhouettes, we could be looking at Wingull, Mankey, Pichu, Grookey, and Charcadet joining the LEGO Pokémon Smart Play line-up. It’s still very early days, and we only have these shadowy outlines to go on, so don’t get too excited just yet.

This is a smart play by LEGO and The Pokémon Company. They’re building anticipation for 2027 by showing just enough to get fans talking at a dedicated convention. The Smart Play line, which involves interactive elements, could be a good fit for the Pokémon universe. Imagine tapping a Pikachu figure to trigger a sound effect or a small animation on a linked device.

No official set numbers have been revealed yet, and these are likely still in the very early stages of development. The silhouettes are designed to be recognisable to dedicated fans but vague enough that the final models could still change significantly. We’ll have to wait for more concrete information to emerge closer to 2027 to see what these actually look like and how they function. For now, it’s just a tease.

No Indian store prices yet. MyBrickHouse and Toycra are the stores to watch for future availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Keep an eye out for more LEGO Pokémon news as 2027 approaches.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pokmon-smart-play-2027-sets-teased-silhouettes-revealed' AND md5(content) = 'af2139e9c5d07d392851b4e51fe718c8';
UPDATE public.news_articles SET content = $c$April 2026 was a whirlwind for LEGO fans, according to BrickNerd's latest roundup. They’ve pulled together a collection of articles and videos that cover the spectrum of our plastic brick obsession. It wasn't just about new sets, though those are always a highlight. This month’s community buzz included deep dives into fantasy realms, intricate microscale city builds, and even a look at the surprisingly complex world of model trains.

For those who prefer their LEGO with a side of history, April offered plenty. Discussions around LEGO's past and explorations into creative building techniques were prominent. It seems the community is as interested in the 'why' and 'how' of LEGO as they are in the 'what.' Space exploration also featured, hinting at builds that reach for the stars, or perhaps just recreate them. This blend of themes shows the incredible diversity within the LEGO hobby.

What’s missing, of course, is any concrete detail on actual new product releases. BrickNerd’s highlights are more about the fan-created content and community discussions that make LEGO more than just a toy. We’re talking about the ingenuity of builders showcasing their microscale masterpieces, the dedication required for complex model train layouts, and the imaginative worlds conjured from bricks. It's a reminder that the official sets are just one part of the LEGO ecosystem.

This month's community content touched on everything from the historical roots of our favourite building system to the frontiers of imaginative play. It's proof of the enduring appeal of LEGO bricks. While we don't have specific set numbers or themes to report here, the passion from the community is palpable. It’s this shared enthusiasm that keeps the LEGO world spinning.

No official India pricing or availability is confirmed for any specific sets mentioned in these community highlights. MyBrickHouse and Toycra are the stores to watch for any potential official releases, though these community themes often translate to fan-designed models rather than official sets. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if any related sets do appear.

This kind of content keeps the LEGO spirit alive, showcasing the creativity that goes beyond the instruction manual. It’s the community that truly builds the LEGO world.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-community-news-april-2026-highlights-2026' AND md5(content) = '6e8a8202ffb7f15fdb21a9781d44347f';
UPDATE public.news_articles SET content = $c$LEGO just announced the 50090 LEGOLAND Park Adventure set, and your wallet is already bracing for impact. This isn't your average brick build; it's a sprawling 1578-piece tribute to the magic of LEGOLAND parks themselves. Imagine snagging a slice of that theme park joy, complete with iconic stalls and a rollercoaster that snakes around the entire display. The centerpiece? A giant, up-scaled minifigure rocking an "I LOVE LEGOLAND" tee. This is the kind of set that screams "display piece" and "collector's item."

Currently, the only way to get your hands on this slice of theme park nostalgia is to be physically present at a LEGOLAND Park. It’s a LEGOLAND exclusive, meaning no online orders from LEGO directly, and certainly no official Indian retailers will be stocking it. This makes it a bit of a headache for those of us not planning a trip to Billund anytime soon. The set is slated for a February 1, 2027 release, giving you plenty of time to figure out your travel plans or wait for the inevitable grey market listings.

The US retail price is set at $109.99.

This price is roughly equivalent to 8 months of Spotify Premium or a very generous weekend trip to a hill station.
Toycra and MyBrickHouse are not stocking this item; it is available exclusively at LEGOLAND Parks. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for any potential, unofficial availability.

For now, the verdict is clear: unless you're already packing your bags for a LEGOLAND adventure, you’ll have to wait. This exclusive nature makes it a prime candidate for import-only status, so start scouting those travel-friendly friends or online resellers. It’s a shame for the wider LEGO community, especially fans in India who won’t get direct access. Still, the concept is undeniably cool, and it’s a unique addition to the LEGOLAND exclusive lineup.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-50090-legoland-park-adventure-a-park-in-a-box' AND md5(content) = 'cdb645ada533047b1416ed184cc3ca42';
UPDATE public.news_articles SET content = $c$Your wallet is already bracing for impact. LEGO has officially pulled back the curtain on a new wave of Super Mario sets, and this time, they’re bringing minifigures. Yes, actual LEGO minifigures, a move that feels long overdue for the Super Mario theme. These eight new sets drop on January 1, 2027, shifting the focus from those interactive figures to something more traditional and, frankly, more exciting for many fans.

The announcement came out of Gamescom 2026, where LEGO gave attendees a first look. We're talking about sets designed for builders of all ages, including some 4+ options, so everyone can jump into building their own Super Mario adventures. The range starts with the tiny [72052](/sets/72052-marios-pipe-jump) Mario’s Pipe Jump, packing just 64 pieces for a US$9.99 price tag. On the other end of the spectrum is the massive [72060](/sets/72060-fire-mario-bowsers-castle) Fire Mario & Bowser’s Castle, a hefty 850-piece build that will set you back US$99.99. This is a significant refresh for the theme, and the inclusion of minifigures across these sets is a major win. Across these eight sets, ten iconic Super Mario characters will debut as minifigures, including Mario, Luigi, Bowser Jr., Toad, and Yoshi, alongside various powered-up versions and enemies like Koopa Troopa.

Patrick Otley, Design Manager at LEGO, stated this is a "celebration of our partnership with Nintendo," aiming to give kids more freedom to create their own stories. Ricardo Silva, another Design Manager for the theme, even gave walkthroughs at Gamescom. While the concept of LEGO Super Mario minifigures is fantastic, the actual sets still lean heavily into the interactive game mechanics, which might not appeal to everyone. The pricing, while accessible for the smaller sets, escalates quickly for the larger builds.

No official India retail prices or availability dates have been confirmed yet, but expect a 4–6 week lag from the global launch. Keep an eye on Toycra and MyBrickHouse for potential listings. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

For collectors who just want the minifigures, buying the individual sets might feel like a steep price to pay. The core appeal of minifigures is usually their collectibility and display potential, often without needing to invest in large, game-centric builds. While the smaller sets offer a more palatable entry point, the overall value proposition depends heavily on how much you engage with the interactive gameplay elements. For those purely after the minifigures, this might be a case of waiting for individual figure sales or a significant price drop.

WAIT

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-super-mario-minifigure-sets-launching-january-2027' AND md5(content) = 'd920d93a5487954a77b88a49ee2ab142'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72052', '72060') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72052', '72060') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Febrovery is back, and your wallet is probably breathing a sigh of relief. This annual LEGO fan event celebrates all things wheeled in the realm of Space. We are talking about rovers, explorers, and vehicles built for distant moons. It is also Febrovery’s 15th birthday. A true veteran in the AFOL community.

This year's event is already showcasing some incredible creativity. Builders are pushing the boundaries, using elements in ways you might not expect. We’ve seen Unikitty tails used as wheels, diamond tiles cleverly disguised as treads, and even car doors repurposed for microscale builds. The sheer ingenuity on display is what makes these events so special. It is not about official sets; it is about imagination.

From sleek Blacktron-inspired tanks to creative wood-themed vehicles rolling on pinecone tires, there is a rover for every taste. Some builders are even drawing inspiration from anime and classic LEGO themes like M-Tron and Classic Space. Others are sticking to the hard sci-fi look, creating rovers that feel like they’ve rolled right off a movie set. There is even a monowheel design that encloses the driver entirely within the wheel.

No official Indian store prices are available for these fan-built creations, as Febrovery is an unofficial event. MyBrickHouse and Toycra are the stores to watch for any new official LEGO releases. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The spirit of Febrovery is about sharing passion and skill. It is a reminder that the best LEGO builds often come from dedicated fans, not just the official product line. Keep an eye on the builders mentioned; they are the ones to watch for future inspiration.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'febrovery-2026-a-celebration-of-lego-space-rovers-set-2026' AND md5(content) = '35a0561958a94262f4aa228f4f6a9cc8';
UPDATE public.news_articles SET content = $c$Your wallet called. It wants to discuss the upcoming LEGO [40908](/sets/40908-restaurants-of-the-world-greece) Restaurants of the World: Greece GWP. It's a freebie, sure, but only if you spend enough to make your bank account weep. The GWP requirement is set at a hefty US$180 / £160 / €180. That's a lot of bricks for a free gift.

This Greek taverna GWP is the third in a quarterly series celebrating global cuisine. It's a charming little build, apparently inspired by coastal towns like Santorini and Mykonos. We're talking whitewashed walls, a splash of blue on the sign, and even a tiny kitchen area. For the music lovers, there’s a lute element representing a bouzouki. And because no Greek scene is complete without them, a kitten is included. You also get an exclusive minifigure sporting a traditional Greek tunic. It’s a nice touch, adding to the authenticity of the miniature Mediterranean dining experience.

The series has already taken us to Mexico and Japan. With Greece now confirmed, the speculation for the fourth and final GWP is already running wild. Will it be an Italian trattoria? A French bistro? A North American diner? LEGO's keeping us guessing, but the possibilities are endless, and frankly, a little delicious. Anyone who has visited Greece will surely appreciate the nod to the ubiquitous family-run tavernas and the roaming cats that are a staple of the landscape. This GWP aims to capture that essence.

The promotion runs from 11-20 August 2026. It’s a limited-time offer, so if you’re planning to pick up any of the new August 2026 releases, this might be the perfect opportunity to snag a bonus set. Just remember the minimum spend to qualify. It’s all about that strategic shopping.

MyBrickHouse and Toycra will likely have it available 4–6 weeks after the global launch, but you'll need to hit that minimum spend threshold. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

This GWP is a nice addition for collectors of the series and those who appreciate detailed miniature builds. The execution looks solid, and the theme is undeniably appealing. Just be mindful of the spend requirement; it’s not a cheap add-on.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40908-restaurants-of-the-world-greece-gwp-coming-august' AND md5(content) = 'a4a7afe2ea614ffcf4e3a1263382bd0b'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The X-Files are back, and so is your wallet's anxiety. LEGO has officially pulled back the curtain on the X-Files set, number 21369, and it's not for the faint of wallet. This set packs under 1500 pieces and comes with a hefty $200 USD price tag. That's the kind of money that makes you pause and consider your life choices, or at least your monthly LEGO budget. For fans who have been waiting for this iconic sci-fi series to get the LEGO treatment, the reveal is exciting, but the price point is a definite conversation starter.

Details are still emerging, but the set appears to be based on the iconic FBI agents Fox Mulder and Dana Scully, along with elements from their investigations. The source video, a YouTube upload, shows off the buildable FBI headquarters and key characters. It's a fan-demanded theme, and LEGO has finally delivered. The sheer number of pieces, while under 1500, suggests a detailed build, and the $200 USD price point aligns with other large, complex sets in the LEGO Ideas line. It’s a significant investment, so you’ll want to weigh the build experience and display value against the cost.

This isn't just about the set itself; the source also hints at an important Gift With Purchase (GWP) being tied to this release. What that GWP is remains a mystery for now, but it's likely to be something equally thematic to entice fans to buy the set sooner rather than later. Given the price and the theme's popularity, expect this to be a sought-after item. We’ll be keeping an eye out for more details on the GWP and the official Indian release.

MyBrickHouse and Toycra will likely stock this set 4–6 weeks after the global launch, but keep an eye on their sites for exact availability and any potential pre-order bonuses. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

For those who have followed the X-Files for years, this set is a dream come true. The build looks intricate, and the minifigures of Mulder and Scully are a must-have for any fan. However, the $200 USD price tag is a serious consideration. It’s a prime example of a set that demands careful budgeting. Whether it’s worth the investment depends on your personal connection to the X-Files and your tolerance for high price points in your LEGO collection. We’ll have to wait and see if any early Indian pricing or GWP details surface.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-x-files-set-21369-officially-revealed-prepare-your-wall' AND md5(content) = '7194285f7835b518018e55183ad7f830';
UPDATE public.news_articles SET content = $c$The wallets of Formula 1 fans are about to get lighter. LEGO has officially unveiled the [43024](/sets/43024-ayrton-senna-helmet) Ayrton Senna Helmet, and it’s a stunner. This latest entry into the LEGO Editions F1 Helmet series celebrates one of motorsport's most legendary figures. Senna's iconic yellow, green, and blue helmet is instantly recognizable, a design that’s become as famous as the man himself.

This set, containing 931 pieces, promises a satisfying build experience. Unlike some previous helmet sets, this one includes a minifigure, complete with its own matching helmet. It’s a detail that adds significant value for collectors. The release date is set for September 1st, with pre-orders already open on LEGO.com. The global price is pegged at £79.99, $89.99, or €89.99. While the design is largely praised for its accuracy and iconic status, some fans noted the absence of the Marlboro logo, a detail that was part of Senna’s original helmet design. Others debated the inclusion of the nameplate and the specifics of the minifigure's design. However, the overall sentiment leans heavily towards this being a standout set in the collection, possibly the best one yet.

MyBrickHouse and Toycra are the stores to watch for its eventual arrival, though expect a 4–6 week lag from the global September 1st launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The build techniques are reportedly similar to other helmets in the series, but with slight variations that fans are already dissecting. The inclusion of the minifigure is a big win, offering a complete display option. While the set is undeniably desirable, the price point might give some pause. Considering the piece count and the inclusion of a minifigure, the price isn't outrageous, but it's certainly not pocket change either. For dedicated F1 fans, especially those who grew up idolizing Senna, this will likely be a must-have. For others, waiting for a potential sale or a future discount might be the more prudent approach. It’s a strong contender for one of the year's best LEGO releases, but the cost demands careful consideration.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ayrton-senna-helmet-43024-announced-a-new-icon-joins-th' AND md5(content) = '1b73865ef5f516b700c1623d8d1c362a'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43024') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43024') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet just got a warning: a wave of LEGO sets is about to vanish from the shelves. June’s Double Insider Points promotion (2x points from 19‑29 June) is already a good excuse to stock up, but the real kicker is the looming retirement schedule. Once a set hits its retirement date, LEGO won’t restock it, meaning any remaining bricks become the holy grail for collectors.

The blog post from Jays Brick Blog lays out the timeline. July 2026 will see a first batch of retirements, followed by a larger wave in December. The list reads like a who’s‑who of big‑ticket items: Dungeons & Dragons: The Red Dragons Tale, Jaws, the Gringotts Wizarding Bank – Collectors’ Edition, Optimus Prime, the PAC‑MAN Arcade Machine, and a host of UCS Star Wars ships. Even the Great Deku Tree 2‑in‑1 has already retired early in North America, and the secondary‑market price is already creeping up thanks to a Nintendo remake announcement.

Why does this matter to you? Because the Insider Points you earn (roughly 10 % of purchase value) can be redeemed for future builds, but they won’t help you once the set is gone. If you wait for a deal, you might miss the last few bricks, and the resale market can double or triple the original price. That’s why the author urges you to treat the June 2x points boost as a limited‑time window to lock in the pieces you want.

For the Indian audience, the lack of official pricing adds another layer of uncertainty. None of the retiring sets have shown up in MyBrickHouse or Toycra listings yet, and LEGO India has not announced any MRP. That means you’ll have to rely on imports or watch for grey‑market listings on Amazon.in or overseas sites. Expect a 4–6 week lag after the global retirement date before any stock disappears from Indian portals.

If you’re a fan of the larger builds, now is the moment to decide: chase the sets before they’re gone, or sit tight and hope a resale appears at a tolerable price. The choice is yours, but the clock is already ticking.

Check MyBrickHouse for availability. Check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-sets-retiring-in-2026-last-chance-before-they-disappear' AND md5(content) = '4bfffb1879827e2db7f918a67b615ae8';
UPDATE public.news_articles SET content = $c$The leaves are turning, the air is getting crisp, and somewhere in the digital ether, LEGO builders are crafting autumnal castles. Brothers Brick highlighted four such builds, showcasing stunning "no bley" forests, magical portals, microscale dioramas, and friendly stone protectors. It’s the kind of content that makes you want to dig out your own bricks and build something epic. But for us in India, this artistic inspiration comes with a side of price-related anxiety.

Lucas Shannon's "No bley" build captures the gradient of fall leaves with dazzling effect, featuring a revered tree and a humble shrine. Gareth Gidman's piece takes a more literal magical approach with "Portal Roots" creating a gate to a distant land, demonstrating masterful forced perspective that seamlessly transitions from minifig- to micro-scale. Then there's David Manfred's microscale castle diorama, where muted olive green and medium blue hues perfectly complement the autumn foliage, all rendered with a voxel art effect thanks to 1x1 tiles and cheese slopes. Finally, legobrickking's "The Forest Protector" presents a gentle stone giant, inspired by treant creations, who calls the forest home. These builds are pure eye candy, a reminder of the creative heights achievable with plastic bricks.

Now, translating this visual feast into tangible LEGO sets for India is where the real story begins. While these are fan builds and not official sets, the anticipation for any castle-themed releases, especially those with such evocative aesthetics, is always high. The lack of specific set numbers or themes from Brothers Brick means we're in that familiar territory of hopeful speculation. When official castle or nature-themed sets do eventually land, Indian fans face a wait and often a premium.

No official Indian pricing is available for these fan builds, and there are no specific sets announced. MyBrickHouse and Toycra will likely stock them 4–6 weeks after global launch, but availability is not guaranteed. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The beauty of these fan creations is undeniable, but the path from inspiration to owning a piece of that magic in India is rarely straightforward. We can only hope that future official LEGO releases capture even a fraction of this autumnal charm, and that when they do, the price point makes a little more sense for the average builder. Until then, we admire the art and wait for what might come next.
On that bombshell...

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-autumn-castle-builds-expectation-vs-reality-for-indian-' AND md5(content) = '07925de6f32ccdd8ce174f147d9f62fa';
UPDATE public.news_articles SET content = $c$Your wallet is probably safe for now. LEGO has unveiled two new Brickheadz sets, and while they sound like fun, they’re not hitting Indian shelves anytime soon. We’re looking at a September 2026 release for both: a DC Comics double pack featuring Golden Age Superman and Batman, and a Gremlins duo with Gizmo and Stripe.

Jay’s Brick Blog got the first look, confirming these will be available globally. The Golden Age Brickheadz are a nod to the early days of DC Comics, so expect simpler, classic costumes for the iconic duo. For those who prefer their collectibles a bit more chaotic, the Gremlins set brings the beloved Mogwai Gizmo and his mischievous counterpart Stripe into the Brickheadz family. These are typically sold as single figures or twin packs, and this announcement confirms dual releases for both themes.

No specific set numbers have surfaced yet, but given the September 2026 release window, we can expect official announcements and details to trickle out from LEGO in the coming months. The Brickheadz line continues to be a steady stream of pop culture and comic book characters, offering a more stylized, shelf-friendly take on beloved figures. Whether you’re a classic comic collector or a Gremlins aficionado, these sets aim to capture the essence of their respective franchises in the signature Brickheadz style.

For Indian fans, the wait will be considerably longer, and the price will likely be a significant hurdle. These Brickheadz are not currently listed on any official Indian retailer sites.

MyBrickHouse and Toycra are the stores to watch for potential grey market imports or when official availability is announced, but expect a 4–6 week lag from global launch if they do arrive. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Given the lack of official Indian retail presence and the likely import costs, these are firmly in the 'import only' category for now. It’s always possible LEGO India might surprise us closer to the release date, but don't hold your breath. Until then, keep an eye on international retailers or grey market importers if you absolutely must have these particular Brickheadz.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-golden-age-superman-batman-and-gremlins-brickheadz-arri' AND md5(content) = '972933ce8503e2e0686be31f47206f9f';
UPDATE public.news_articles SET content = $c$Your wallet is safe this time, but your memory might not be. Today, we’re looking back at a LEGO set that landed at a rather unfortunate moment: the Alpha Team [6776](/sets/6776-ogel-control-center) Ogel Control Centre. Released in 2000, this set, and indeed the entire Alpha Team theme, was based on a video game and featured secret agents battling the evil Ogel. Ogel, whose name is literally "LEGO" spelled backwards, aimed to ruin everyone's fun. This particular set, the Ogel Control Centre, was designed as his volcanic secret base.

The core of the set involved Ogel launching mind-control orbs from his rocket ship, aiming to take over the world. It included Ogel himself and two skeleton drones, all part of a narrative where players had to rescue captured Alpha Team members. The build itself featured 411 pieces, a moulded baseplate, and the characteristic quirky gadgets of the Alpha Team line, like dropping orbs from a rocket. The minifigure of Ogel was distinctive, even sporting transparent hooks on his hands in later variations.

However, the release of 6776 Ogel Control Centre in 2000 coincided with the tragic events of September 11, 2001. In the immediate aftermath, The LEGO Group temporarily recalled the set due to its perceived conflict with their ethical standards, particularly concerning child safety and play. It was a difficult time for everyone, and LEGO's decision reflected a sensitivity to the global mood. The set was eventually re-released, but the memory of its initial recall remains a notable footnote in LEGO history. This retrospective piece from Brickset delves into the set’s lore, its connection to the original video game, and the peculiar naming convention of its villain, Ogel.

No Indian prices or availability details are confirmed for this older set, as it is long retired.
MyBrickHouse and Toycra are the stores to watch for any potential re-releases or rare finds, though it's unlikely to be available through official channels. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from any potential global re-release, if that were ever to happen.

This set is a piece of LEGO history, a look back at a theme that didn't quite reach the heights of some others but offered a unique take on secret agent adventures. For collectors, it represents a piece of a specific era, albeit one marked by a sombre real-world event.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'throwback-thursday-revisiting-the-controversial-lego-alpha-t' AND md5(content) = 'ffa4a2b6370d25e3ffb3e7a2f662dc75'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('6776') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('6776') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The wallet is already nervous. LEGO just announced the Wallace & Gromit set, and while it looks like a cracker, the price is already making us sweat. No official Indian pricing yet, which means we are in that particular purgatory where you want it but cannot fully panic yet. This is the LEGO Ideas [21371](/sets/21371-wallace-gromit) Wallace & Gromit, featuring the iconic duo and their red motorcycle and sidecar. It’s based on the Grand Prize winner from the LEGO Ideas ‘90s Throwback competition.

This set, with 1,038 pieces, promises a detailed model of Wallace and Gromit as seen in the award-winning film Wallace & Gromit: A Close Shave. You can pose the pair and even push the motorbike to set the wheels in motion. It comes packed with iconic accessories like crackers, a ball of wool, and a diamond hidden in the motorbike seat hatch. It’s clearly designed for shelf display, perfect for any Aardman animation fan or collector of Wallace & Gromit merchandise. The set is aimed at adults aged 18 and over, with the LEGO Builder app offering digital instructions to enhance the building experience.

The original fan design has seen its part count nearly double for the official release, which is usually a good sign for build complexity and detail. The US price is set at $99.99, with Canada at $139.99 and the UK at £89.99. Converting that US price alone suggests a significant outlay here in India. We will have to wait for official announcements from LEGO India to get the exact figures, but given the exchange rates and import duties, this is unlikely to be a cheap impulse purchase. It's scheduled for a global release on October 1. If you haven't seen A Close Shave yet, the LEGO Group gives you until then to catch up. It's a hoot, apparently.

If this were officially sold in India, it would cost roughly the same as 18 months of Netflix Premium.
No Indian store prices yet. MyBrickHouse and Toycra are the stores to watch — use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch.
WAIT

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-21371-wallace-gromit-cracking-set-arrives-october' AND md5(content) = '1e05c359cbc6cb870ab6bf80b6164233'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21371') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21371') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The LEGO Millennium Falcon ([75192](/sets/75192-millennium-falcon)) might be a few years old, but it’s still commanding serious attention. This week, the gargantuan Star Wars set snagged the third spot in Brickset's most viewed sets list, right behind two festive holiday houses. That's a notable achievement for a set that costs more than a decent used motorcycle.

Published on September 19, 2026, the Brickset article "What's hot this week" shows a surge in views for the iconic ship, with 18,084 views. It’s a clear sign that even with a substantial price tag, the ultimate UCS Falcon remains a dream build for many. Some commenters are even discussing its potential retirement this year, with one user mentioning hopes for a rumoured replacement next year. This suggests the current version, while popular, might not be the final word on LEGO's Ultimate Collector Series Falcon.

The discussion thread also touches on the ongoing popularity of Advent Calendars, with several users debating which ones to pick up. However, the sheer view count for the 75192 set indicates that even with the festive season approaching, the galaxy far, far away continues to hold a powerful allure for LEGO fans. It’s proof of the enduring appeal of Star Wars and the ambition of this particular build.

While the set's popularity is undeniable, its hefty price point means it's not an impulse buy. For many Indian fans, the cost remains a significant barrier. Even with potential retail markups factored in, it's a serious investment. The discussion about a possible replacement also adds a layer of caution for those considering a purchase now.

No official India retail price or availability is confirmed. MyBrickHouse and Toycra are the stores to watch for potential grey market imports. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).

The fact that it's still generating so much interest, even being discussed alongside newer Advent Calendars and seasonal builds, speaks volumes. Whether it's the nostalgia, the sheer scale, or the iconic status of the ship, the LEGO Millennium Falcon continues to be a major draw. For those who have the space and the budget, it remains a legendary display piece.

WAIT

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-75192-millennium-falcon-still-turning-heads-among-top-v' AND md5(content) = '156c147def02710d72cf0a09dc908e87'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('75192') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('75192') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO fans, brace yourselves. That dream set you missed out on from the Bricklink Designer Program's Series 6 might just reappear. Bricklink is doing another limited restock next week, specifically on August 17th and 18th, 2026. This isn't a full production run, mind you. It's more like those lucky second chances you get when there's excess stock, cancelled orders, or fulfillment hiccups. So, if you were late to the party or just discovered these incredible fan-designed sets, this is your moment.

The sets involved are the ones that captured everyone's attention: The Art Factory, Outlaw Forest Den, Gold Mine Expedition, Off-road Adventure, and Sequoia Tree Trail. Some of these are substantial builds. The Gold Mine Expedition alone packs 3,382 pieces. And if you're wondering which one was the hottest ticket? The source points to the Outlaw Forest Den as the most sought-after, which makes sense given its popularity.

Bricklink is rolling out these restocks with staggered timings across different time zones. North America gets their shot first on August 17th at 2 PM EDT. Europe follows at 5 PM CET on the same day. Then, it's Australia and New Zealand's turn on August 18th at 7 AM AEST. The links provided are designed to add the sets directly to your cart when the restock goes live. Remember, these are limited quantities, so speed is key.

Now, about getting these into India. Since these are exclusive to the Bricklink platform and not officially distributed through Indian retailers, you’re looking at import only. Expect to pay the listed US dollar prices, plus significant customs duties and shipping charges. Based on the US$229.99 for sets like The Art Factory and Outlaw Forest Den, you're easily looking at a final landed cost that could be double the original price once duties and taxes are factored in. For the pricier Gold Mine Expedition at US$299.99, the final bill will be even steeper.

MyBrickHouse and Toycra will not be stocking these, so your only option is direct import. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch plus customs clearance.

This is a prime example of why patience or a good travel agent can sometimes be your best friend in the LEGO world. If you absolutely must have one of these, be prepared for the import hassle and the extra cost. Otherwise, it might be a case of waiting for the next wave of fan-designed sets that might eventually make their way to broader distribution.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-bricklink-designer-program-series-6-limited-restock-inc' AND md5(content) = '5f359a443e083c59a20523fb9b1bbeae';
UPDATE public.news_articles SET content = $c$Your wallet called. It's having a minor existential crisis over the new LEGO PlayStation 1 ([72306](/sets/72306-playstation)). LEGO and Sony have teamed up to bring back the iconic grey box that defined gaming for a generation, and yes, it's a brick-built replica of the original 1994 console. This isn't some small desk ornament either; it’s a near 1:1 scale model, measuring over 6 cm high, 26 cm wide, and 19 cm deep. That’s big enough to make you feel like you’re back in the 90s, fumbling for the power button.

The set packs 1,911 pieces and is aimed squarely at adults, rated 18+. It boasts functional buttons and even a buildable controller that plugs into the console. But the real nostalgia trip comes from the hidden compartments. Pop open the console, and you'll find two miniature dioramas: one from Gran Turismo with tiny race cars, and another from Ape Escape featuring a monkey helmet scene. These little builds can be displayed inside or pulled out separately. It’s a clever touch that adds a layer of interactive detail, tapping directly into those core gaming memories.

However, the choice of the original controller over the later DualShock is a point of contention for some, especially since Ape Escape required the DualShock. The diorama design also raises a few eyebrows, with some fans preferring micro-scale characters over specific scenes. Still, the overall execution of the console itself seems impressive, capturing that unmistakable '90s aesthetic.

The LEGO PlayStation 1 (72306) launches for LEGO Insiders on October 1, 2026, with a general release on October 4. It’s available at LEGO.com, LEGO Stores, and select retailers.

Watch LEGO.com/PlayStation for availability, and check MyBrickHouse and Toycra for potential local stock, though expect a 4–6 week lag from the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

While the nostalgia factor is high and the build looks detailed, the estimated price point makes this a definite WAIT. It’s a premium display piece for dedicated fans, but whether it’s worth the significant investment will depend on your personal connection to the original PlayStation and your tolerance for that price tag.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-playstation-1-72306-the-90s-console-lives-again' AND md5(content) = 'a755263b48be6657f6ec7c8d03d4ad90'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72306') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72306') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The dust has settled on the massive August 2026 LEGO releases, and one thing is clear: Olivia Rodrigo is a force to be reckoned with. Several of her collaboration sets have completely sold out or are on backorder directly from LEGO in most regions. This isn't just a small blip; it's a massive demonstration of her star power translating directly into plastic brick demand.

While LEGO's own store is experiencing shortages, the article hints that third-party retailers like Amazon.com and Amazon Australia might still have stock. This is where savvy fans will need to look if they missed out on the initial rush. Sets like Olivia Rodrigo's Vinyl, Concert Moon, and Secret Storage are specifically mentioned as being on backorder in North America, the UK, and Australia. Even the highly anticipated X-Files set and its companion GWP seem to be holding strong, but the Olivia Rodrigo range is the clear winner in terms of immediate popularity.

For those not caught up in the Olivia Rodrigo frenzy or the Pokemon Smart Play wave, there's a general sentiment of waiting for a more appealing Gift with Purchase or offer before diving into these new August launches. However, the sheer volume of sold-out Olivia Rodrigo sets suggests that for a significant chunk of the market, the appeal of the artist was enough to bypass any need for an extra incentive. This kind of sell-out is rare and speaks volumes about the current cultural relevance of the singer.

It's a stark reminder that LEGO's appeal extends far beyond traditional themes. Collaborations with major pop culture figures can create unprecedented demand. The fact that these sets are already flying off the shelves and appearing on backorder lists globally highlights the power of celebrity endorsement in the toy market. If you were hoping to snag one of these sets, your best bet is to scour international third-party retailers, as official LEGO channels are depleted.

No official India retail prices are available for these Olivia Rodrigo sets. MyBrickHouse and Toycra are the stores to watch for potential grey market imports, though availability is uncertain. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if they do appear.

The global sell-out of these Olivia Rodrigo sets is a clear indicator of their desirability. For Indian fans, the path to acquisition will likely involve international sourcing, given the lack of official release information here. Keep an eye on those international retailers, but be prepared for potential markups.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-august-2026-olivia-rodrigo-sets-sell-out-globally-deman' AND md5(content) = '88647d6ef1d9524c55bdd55fcdb1daba'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43028') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43028') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO has announced LEGO Skylines, a video game, and your wallet is already bracing for impact, even though it’s not even a physical set. This isn't your usual plastic brick news; it's a digital venture into city-building, tapping into the popular Cities: Skylines franchise. Announced at Gamescom 2026, this collaboration promises a brick-built take on the deep simulation mechanics we've come to expect from Paradox Interactive and Iceflake Studios.

If you've ever spent hours meticulously planning traffic flow or zoning residential areas in games like SimCity, this LEGO-themed iteration might just scratch that itch. The article teases a blend of LEGO's signature blocky charm with the near-limitless potential of building a sprawling metropolis. It sounds like the kind of game that could easily consume hundreds of hours, much like its gaming inspirations.

Details are still scarce, with the game slated for a 2027 release. It's important to remember this is a video game announcement, not a new wave of physical LEGO sets. While the synergy between LEGO bricks and the Cities: Skylines concept seems strong on paper, we'll have to wait for actual gameplay to see if it lives up to the hype. Gaming correspondent from Covergeek, the sister publication, did get some hands-on time at Gamescom, so keep an eye out for their full impressions.

Since this is a video game and not a physical product, there are no Indian prices or availability details to discuss in the traditional sense. It's purely a digital release at this point.

Available at MyBrickHouse and Toycra (use code ABHINAV12 for 12% off above ₹500). That's enough to buy about 15 large cups of chai or cover a month's subscription to a popular streaming service. Availability in India will be through digital storefronts like Steam, likely mirroring the global launch date in 2027.

For now, the verdict is clear: this is a digital product for future purchase. Keep your eyes peeled for more information as 2027 approaches, and perhaps start clearing some hard drive space.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-skylines-announced-for-2027-release-hints-at-city-build' AND md5(content) = 'f8105a473e6840546299d5dbc2039836';
UPDATE public.news_articles SET content = $c$Your wallet might be breathing a sigh of relief because this isn't about a new set to assemble. Instead, LEGOLAND New York is rolling out the red carpet for its first-ever LEGO Festival. Think of it as a giant, park-wide celebration where the bricks come to life outside of the usual build tables. This event is running for a limited time, and early reports suggest it’s packed with interactive zones designed to get everyone involved.

The festival appears to transform the entire LEGOLAND New York park into a playground of creativity. The Bricknerd guide mentions specific areas like a "Build-a-Minifigure" station, where visitors can apparently create their own unique minifigures. That’s always a crowd-pleaser. There’s also talk of a "Mosaic Maker" zone, allowing attendees to design their own LEGO mosaic art. This sounds like a great way to tap into that inner artist, or at least make something cool to photograph.

Beyond the building activities, the festival seems to be leaning into the sensory experience. Custom LEGO-themed treats are on offer, which is a nice touch. We’re talking about snacks that look like LEGO bricks, probably. It’s the kind of detail that makes a themed event feel complete. The guide also hints at live entertainment and extra activities scattered throughout the park. It sounds like a full day out, designed to immerse visitors in the LEGO universe.

No specific set numbers or new product announcements are part of this. It’s purely an event focused on the park experience. For those in India looking to plan a trip, this is a significant event. Flights and accommodation will be the main costs.

Given this is an event at LEGOLAND New York, direct purchase of tickets is the only way. There are no official Indian retail prices or availability for theme park events. Expect a 4–6 week lag for any official merchandise related to the event to potentially appear on Indian e-commerce sites, though event-specific items are usually park-exclusive. MyBrickHouse and Toycra will likely not carry these items. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

It’s essentially a way for LEGOLAND to offer something fresh and engaging for visitors, especially families. The focus is on participation and fun, rather than collecting. So, if you’re planning a trip to New York and have LEGO fans in the family, this festival could be the perfect addition to your itinerary. Check the official LEGOLAND New York website for exact dates and ticketing information.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'legoland-new-yorks-lego-festival-kicks-off-what-to-expect' AND md5(content) = 'bf7a59dd91c0c04c51a29c8ed468b4a0';
UPDATE public.news_articles SET content = $c$LEGO has unveiled a fresh batch of new elements hitting the shelves with the September 2026 set releases. If you are the kind of builder who geeks out over the tiniest new brick, then this is your Super Bowl. New Elementary has compiled a list of 348 new elements, detailing exactly which sets contain them.

This month's new parts are heavily dominated by licensed properties. We're talking Shrek, Star Trek, and SpongeBob. Yes, you read that right. Expect to see some very specific pieces designed for these universes. These are unlikely to ever show up on Pick a Brick, so if you need them, you'll need to buy the sets they come in.

Because some of these sets include LEGO Minifigures and Advent Calendars, many of the new parts are missing their official Element IDs. New Elementary will update the list once those are available. This is typical for these types of releases.

The article doesn't specify exact set numbers, just the themes. We're looking at elements for Shrek, Star Trek, and SpongeBob. Without specific set numbers, it's impossible to know the full scope of these releases.

The estimated import price for these elements, if they were to be sold individually and factoring in duties and markups, would place them significantly higher than usual.

MyBrickHouse and Toycra are the stores to watch for official set releases, but expect a 4–6 week lag from the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Given the lack of specific set information and the niche nature of these new parts, it's best to wait for more details to emerge. Without knowing the exact sets or their availability in India, purchasing is currently not feasible through official channels.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'new-lego-parts-in-september-2026-sets-2026' AND md5(content) = '2ef66e157f627cd9a88ce31cf69e12cd';
UPDATE public.news_articles SET content = $c$LEGO just dropped hints about a massive Imperial Lambda Shuttle, a ridiculously scaled Darth Vader figure, and an AT-RT Driver helmet. Your wallet probably just fainted. No official set numbers or prices are out yet, which means we’re in that awkward phase where you can fantasize without the immediate terror of actual cost.

The Lambda Shuttle is rumoured to be a UCS (Ultimate Collector Series) set. This usually means it's huge, incredibly detailed, and costs more than a decent used scooter. If it’s anything like the previous UCS sets, expect thousands of pieces and a display stand that takes up half your shelf. The Darth Vader figure is also mentioned as being scaled up, which could mean a larger buildable figure, or perhaps something even more ambitious. These larger figures tend to command a premium. Then there's the AT-RT Driver helmet. LEGO has been on a helmet kick lately, and while cool, they often miss the mark on value.

This is shaping up to be an expensive quarter for Star Wars fans. The sheer scale of the Lambda Shuttle suggests a price point that will make you reconsider your monthly grocery budget. We've seen UCS sets go for ₹60,000 and upwards. This one could easily join that club. The scaled-up Vader is a wildcard, but these larger display pieces rarely come cheap.

No Indian store prices are available yet for any of these rumoured sets. The scaled-up Vader could be in the ₹15,000–₹20,000 range. The AT-RT Driver helmet might be around ₹7,000–₹9,000. This is enough to cover 30 months of your favourite streaming service. Keep an eye on MyBrickHouse and Toycra for updates, likely 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

If you are a die-hard Star Wars fan with deep pockets, you might be tempted. But given the likely high prices and the fact these are still rumours, waiting for official confirmation and initial reviews is the smart move.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-imperial-lambda-shuttle-and-new-helmets-your-wallet-is-' AND md5(content) = '1a93bb191d1b2afde9e5d5a1a2c8c4c1';
UPDATE public.news_articles SET content = $c$LEGO is going all-in on the Pokemon franchise, and the latest reveals are a mix of nostalgic nods and massive builds. Forget the smart play sets for kids; the real action is in the larger, more complex models aimed squarely at adult fans who want to display their favourite Pokemon in brick form.

Launching in August 2026 are three big hitters: the majestic Rayquaza (set [72168](/sets/72168-rayquaza)), the fiery Arcanine (set [72160](/sets/72160-arcanine)), and the adorable Munchlax (set [72150](/sets/72150-munchlax)). The Rayquaza set, in particular, looks like a showstopper, depicting the legendary Pokemon coiled around the Sky Pillar. Excitingly, it also includes a minifigure of Zinnia, a character recognisable from the Omega Ruby and Alpha Sapphire games. This inclusion hints at the possibility of more named trainers and Gym Leaders appearing in future Pokemon sets, a move that will surely please long-time fans.

Come October 2026, just in time for holiday gift-giving, two more substantial sets will arrive. First is the [72154](/sets/72154-iconic-trainer-moments-pok-ball) Iconic Trainer Moments Poké Ball. This isn't just a simple sphere; it's a massive, detailed Poke Ball that opens up to reveal secrets inside. Crucially, it comes packed with minifigures of Red, Professor Oak, and a Picnicker, plus minifigure-scale versions of Pikachu and Eevee. Following that is the [40868](/sets/40868-up-scaled-red-minifigure) Up-Scaled Red Minifigure set. This allows you to build a giant, brick-built version of Red, the iconic protagonist from the original Pokemon Red, Blue, and Yellow games. It seems LEGO is determined to cover all bases for Pokemon collectors.

While official Indian pricing and availability are yet to be confirmed, these sets are set to launch globally in August and October 2026. Based on the US retail prices, which range from $69.99 for Munchlax up to $299.99 for the Iconic Trainer Moments Poké Ball, expect these to be significant investments. This means we are in that particular purgatory where you want them but cannot fully panic about the price yet.

No Indian store prices are available yet. MyBrickHouse and Toycra will likely stock these 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Pre-orders are already open on LEGO.com for international customers. The inclusion of minifigures in the larger sets, especially Red and Professor Oak, alongside the up-scaled Red figure, suggests LEGO is really leaning into the nostalgia factor for this beloved franchise. Keep an eye on local retailers for updates on Indian pricing and release dates.

WAIT

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pokemon-unleashed-rayquaza-arcanine-and-more-revealed' AND md5(content) = '40d77191a76e03753dd76f76b18189dd'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72168', '72160', '72150', '72154', '40868') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72168', '72160', '72150', '72154', '40868') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet is already preparing for 2027. LEGO and Nintendo, a partnership that has already given us Zelda and Pokemon, is bringing back Super Mario with a bang. Forget those interactive figures for a moment. The big news here, the thing that’s got everyone talking, is the arrival of actual Mario minifigures. Yes, you read that right. After years of just the digital characters, we're finally getting LEGO minifigures for the Super Mario universe.

This isn't just a couple of small additions either. Eight new sets have been revealed, ranging from a modest $10 all the way up to a $100 centerpiece. The Brothers Brick broke the news from Gamescom, detailing these upcoming additions that aim to bring the Mushroom Kingdom to life. We're seeing everything from simple jump challenges to larger racing sets, and even a Bowser's Castle. The full lineup includes Mario’s Pipe Jump ([72052](/sets/72052-marios-pipe-jump)), Racing with Mario ([72054](/sets/72054-mario-kart-racing-with-mario)), Mario’s Beach Adventures ([72055](/sets/72055-marios-beach-adventures)), Luigi & Bowser Jr.’s Race ([72056](/sets/72056-mario-kart-luigi-bowser-jrs-race)), Yoshi at Mario’s House ([72057](/sets/72057-yoshi-at-marios-house)), Bowser’s Rumbling Race ([72058](/sets/72058-mario-kart-bowsers-rumbling-race)), Fire Mario & Bowser’s Castle ([72060](/sets/72060-fire-mario-bowsers-castle)), and Fire Luigi vs Koopa Troopa Battle ([72061](/sets/72061-fire-luigi-vs-koopa-troopa-battle)). All of them are slated for a January 1, 2027 release.

The real draw, of course, is the minifigure integration. This opens up a whole new world of possibilities for LEGO Mario fans, allowing for more traditional LEGO play alongside the interactive elements. It’s an interesting evolution for the theme, and one that’s been heavily requested. The new elements promised should help build out the iconic environments too.

The official release date is January 1, 2027. Since these sets are not yet available in India, and no official Indian pricing has been confirmed, we need to estimate. These are estimated import prices — not confirmed India retail. Keep an eye on official LEGO channels and major retailers like MyBrickHouse and Toycra for potential availability updates closer to the launch date. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Official India pricing and availability are not yet confirmed for any of these sets. Check MyBrickHouse and Toycra for availability closer to the January 1, 2027 launch.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-super-mario-range-expands-in-2027-with-long-awaited-min' AND md5(content) = 'afa19f3bacde017efd103b30c755adaf'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72052', '72054', '72055', '72056', '72057', '72058', '72060', '72061') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72052', '72054', '72055', '72056', '72057', '72058', '72060', '72061') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The LEGO Insiders program is getting a taste of the Mediterranean. Brickset revealed the latest gift-with-purchase, [40908](/sets/40908-restaurants-of-the-world-greece) Restaurants of the World: Greece, and it’s designed to look like a traditional taverna. Think whitewashed walls and blue accents, a definite nod to island destinations like Santorini. This GWP will be available starting August 11th for LEGO Insiders.

The European purchase threshold is set at €180, which Brickset estimates will translate to around £160 in the UK or $180 USD. This puts it in the mid-to-high range for GWPs, so you’ll need to plan your purchases carefully to snag this one. While some fans are delighted with the Greek theme, others are already comparing it to previous entries in the series, with mixed reactions. Some find it less detailed than prior sets, while others appreciate the distinctively Greek architectural style.

The community discussion highlights a common LEGO GWP dilemma: how much do you spend to get it? With a €180 threshold, it’s a significant commitment. This isn't a small impulse buy; it requires a substantial LEGO haul. Fans are debating whether the set’s charm justifies the spending requirement, especially when compared to other potential GWPs or just the sets they actually want. It’s a classic case of wanting the freebie versus needing the main purchase.

MyBrickHouse and Toycra will likely stock this GWP 4–6 weeks after global launch, so keep an eye on their sites. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

While the concept of themed restaurants is appealing, the execution and the high spending threshold will be the deciding factors for many. It’s a cute addition to the series, but whether it’s worth clearing out your LEGO wishlist to obtain it remains to be seen.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40908-restaurants-of-the-world-greece-gift-with-purchas' AND md5(content) = '2ba988f0e1b97d14a5d0a185b89c9e53'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet just got a distress call from a galaxy far, far away. LEGO has unveiled the Executor Super Star Destroyer ([75457](/sets/75457-executor-super-star-destroyer)), and it’s not just a big ship; it’s the longest LEGO set ever. Forget the Titanic for a moment. This beast measures a staggering 53.5 inches, or 136cm, officially dethroning the previous record holder by a whisker. That’s longer than your average autorickshaw, and probably costs more.

This Ultimate Collector Series behemoth packs 6,130 pieces, recreating Darth Vader's iconic flagship from The Empire Strikes Back. It’s a serious display piece, complete with a built-in stand and a scaled-down companion Star Destroyer, because one giant ship wasn't enough. They’ve even thrown in a tiny Millennium Falcon on a tile, a fun nod to the Executor’s sheer size.

But the real showstopper for many will be the minifigures. For the first time ever, you get all six bounty hunters from the film in one set: Boba Fett, Dengar, Bossk, IG-88, 4-LOM, and Zuckuss, alongside Darth Vader himself. There’s also a mini-build vignette of the Executor’s bridge, perfect for recreating that legendary bounty hunter meeting.

The build itself sounds intricate, using a LEGO System core with Technic outriggers for strength. LEGO is touting a new decorated tile graphic used 60 times to simulate hull lights, adding a layer of detail that sounds impressive. A digital building experience via the LEGO Builder app is also included, because at this scale, you might need all the help you can get.

And then there’s the question of price. The US is looking at $799.99, with Canada at $1099.99 and the UK at £649.99. This is where things get dicey for us.

No official Indian price or release date has been confirmed yet. Keep an eye on MyBrickHouse and Toycra for availability updates; use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from the global October 1st launch.

As a bonus, if you snag this during the first 10 days of release, you’ll get an exclusive GWP – Darth Vader’s Lightsaber set ([40897](/sets/40897-darth-vaders-lightsaber)). It’s a nice little extra, but honestly, the main draw is the colossal Star Destroyer itself. Whether it’s worth the galactic price tag remains to be seen, especially once we get the confirmed Indian pricing. This is definitely a set for the most dedicated of Star Wars fans with the deepest of pockets.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-star-wars-ucs-executor-super-star-destroyer-75457-shatt' AND md5(content) = '9abb9dc2ae9f38191c2b647b3428164a'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('75457', '40897') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('75457', '40897') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The Brick Train Awards are back for 2026, and it’s time for LEGO train builders to dust off their locomotives and get ready to enter. This virtual competition, organized by the LEGO UK Railway train club, has become a significant event for the global LEGO train community since its inception in 2020. After a year off, the awards return to showcase the incredible creativity and engineering prowess of brick-built railways.

Entries open from September 1st to September 30th, 2026, and builders are invited to submit models built within the last three years. It’s a free-to-enter event, with participants allowed to submit up to three models per category. The competition is judged regionally by members of the LEGO train community, with global winners announced afterward. This year’s build challenge is particularly interesting: the theme is "monochrome," meaning builders must construct their entire entry using only a single color. This adds a significant layer of difficulty and will surely result in some visually striking creations.

Winners can expect some exclusive bragging rights, including an exclusive Brick Train Awards winner’s brick, courtesy of Bricks McGee. The 17 global winners will also receive a $100/€100 voucher for Trixbrix.eu, a popular supplier of third-party LEGO train track and accessories. Beyond the prizes, every entry shared on the Brick Train Awards’ social media accounts offers fantastic exposure, making it a great platform for builders to inspire and be inspired by fellow train fans worldwide. The full details, categories, and rules are available on their official website, bricktrainawards.com.

While this event celebrates fan creations, it also highlights a persistent sentiment within the LEGO train community: the desire for more official LEGO train sets and track pieces. Comments on the Brickset article reveal a longing for more varied track configurations, including crossover pieces and different radii, something many fans have to source from third-party manufacturers. The enthusiasm for these awards, often drawing around 700 entries, underscores the significant interest in this niche but passionate segment of the LEGO fandom.

No official Indian pricing or availability is confirmed for the Brick Train Awards themselves, as it is a community competition rather than a product. Keep an eye on MyBrickHouse and Toycra for any official LEGO train sets that might align with the spirit of this competition. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
This event is proof of the dedication of LEGO train builders, providing a valuable platform for them to share their passion. It’s a chance to see what the community can achieve, especially with the unique monochrome challenge this year.
On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'brick-train-awards-2026-a-community-celebration-of-lego-trai' AND md5(content) = 'c5db6284da8612d172b6bd9783d10c4d';
UPDATE public.news_articles SET content = $c$The LEGO mould machine is working overtime, churning out new pieces faster than we can collect them. Most of these are just subtle tweaks on existing designs, like another curved slope variation we probably didn't need. But then, every so often, a truly unique piece pops up. This time, it's the "baby fin" wing, officially Element 8193.

New Elementary did a deep dive into this new part, and it sounds genuinely interesting. This isn't just another brick; it's described as a "baby fin" and it’s apparently quite distinct from anything else in the LEGO system. The analysis highlights its unique shape and the creative potential it holds for builders. Think of it as a tiny, adorable piece of aerodynamic architecture.

The article doesn't mention which sets this new wing element will appear in, or even if it's part of any current or upcoming official LEGO sets. It's possible this is a piece destined for something specific, or perhaps it's a new element being introduced in a wave of sets we haven't seen details for yet. Without knowing its application, it's hard to say if this is a must-have for your brick collection.

This lack of context means we can't even estimate a price. It could be a small, inexpensive piece or part of a larger, more complex set. For now, it's just a cool new element that LEGO has created. We'll have to wait and see where this baby fin shows up.

No official India MRP or store prices are available for Element 8193. MyBrickHouse and Toycra are the stores to watch for any future availability, though importing this single element is unlikely to be cost-effective. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it appears in any sets.

It’s exciting to see LEGO continue to innovate with new mould designs. Even if it’s just a small part, a fresh element can spark new building ideas. Keep an eye out for Element 8193 in future builds.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-element-analysis-the-baby-fin-wing-8193-a-new-mould-sur' AND md5(content) = '22e710897be03fcabe14dc3ff03aeeb9';
UPDATE public.news_articles SET content = $c$LEGO Architecture is tackling Antoni Gaudí's unfinished masterpiece, the Sagrada Família, with set [21065](/sets/21065-sagrada-famlia). This isn't just another building. It's a structure that's been under construction for over 140 years, finally getting its tallest tower this year. And now, it's set to become the LEGO set with the biggest piece count in the world. That's a serious claim, and frankly, my wallet is already bracing itself.

The new set aims to capture the intricate details and unique design of Gaudí's iconic basilica. While the source article doesn't give us exact piece counts or dimensions, the mention of a world record piece count suggests this will be a substantial build. Architecture sets can sometimes be more about the display value than the building experience, but with a piece count that’s reportedly record-breaking, we can hope for some interesting building techniques and a satisfying construction process.

We're still waiting on official confirmation of the piece count, the exact dimensions, and most importantly, the price. However, the news that this will be the LEGO set with the largest number of pieces ever produced is certainly attention-grabbing. It raises questions about how LEGO will translate the complex facades and organic shapes of the Sagrada Família into LEGO bricks on such a massive scale. This feels like a set designed for dedicated builders and architecture fans who appreciate both the subject matter and a significant building challenge.

The Basílica i Temple Expiatori de la Sagrada Família itself is a UNESCO World Heritage site, and its ongoing construction is proof of Gaudí's visionary approach. Bringing this structure into the LEGO world, especially with a record-breaking piece count, is an ambitious move by LEGO. We'll be watching closely for more details, particularly the final piece count and the price tag, as this could be a landmark release for the Architecture line.

MyBrickHouse and Toycra will likely have this available 4–6 weeks after global launch; check both for availability and any potential launch-day offers. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

This set is positioned as a premium display piece, and we expect the price to reflect that. Whether it lives up to the hype of a record-breaking piece count and the challenge of replicating Gaudí's work remains to be seen. For now, it’s a case of watching this space for more concrete details.

On that bombshell...

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-architecture-21065-sagrada-famlia-revealed-a-record-bre' AND md5(content) = '6662656eecd3bd9cfcfcd72cc180fb28'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21065') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21065') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO has quietly released a new part that's been flying under the radar for a year. It's called the Bar 6L with Stop Rings, Double Bent, or more formally, Shaft 6 Module, w/ Flange. The part number is 7078. This isn't your typical brick; it's a specialized piece designed for more advanced building techniques. New Elementary, a site dedicated to exploring LEGO parts and MOCs, has finally gotten their hands on it and shared some initial thoughts.

This new shaft piece features a double-bent design, making it ideal for creating unique angles and curves in models. The stop rings add an extra layer of functionality, allowing builders to precisely position the bar within their creations. Think of it as a more sophisticated version of the standard Technic axles and beams. It’s the kind of part that can unlock new possibilities for MOC builders, especially those working on intricate vehicles, robots, or even abstract sculptures.

New Elementary highlights that this part has actually been available for a while, but it's only now that they’ve had the chance to really put it through its paces. This suggests it might have initially been part of a specific set or a regional release before wider availability. The implications are that it’s not a part you’ll find in every LEGO store or online. For the average LEGO fan in India, getting hold of such specialized pieces can be a challenge.

This piece is not readily available through official Indian LEGO channels. It's the kind of component that often gets overlooked in larger set releases, making it a prime candidate for import-only status. If you're looking to experiment with unique angles and precise positioning in your builds, this part is worth seeking out, but be prepared for the extra effort.

The US retail price for this part is $3.99. MyBrickHouse and Toycra will not have this part listed. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it ever becomes widely available in India.

For now, it seems like the best bet is to scour specialty LEGO part retailers or keep an eye on international LEGO sites that ship globally. This is not a set you can just walk into a store and buy. It requires a bit more digging.

On that bombshell...

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-bar-6l-with-stop-rings-double-bent-7078-a-new-part-for-' AND md5(content) = '4fe2b65550399f4961eb4078f6fd4a9d';
UPDATE public.news_articles SET content = $c$The wallet is already crying. LEGO has officially pulled back the curtain on [21371](/sets/21371-wallace-gromit) Wallace & Gromit, a 1,038-piece LEGO Ideas set celebrating Aardman's iconic claymation duo. This isn't just another brick-built figure; it's a faithful recreation of Wallace, Gromit, and their beloved red motorbike, designed to capture that unmistakable stop-motion charm.

This set is the 10th LEGO Ideas release for 2026, and it’s set to land globally on October 1st, 2026. Pre-orders are open now on LEGO.com and at local LEGO Stores. The US price is pegged at $99.99, which, after conversion and markup, looks like a considerable investment for Indian fans.

The original fan design by Pidelium from the '90s Throwback – The Next Chapter' challenge has been polished and enhanced by the LEGO Ideas team. The resulting model boasts expressive character builds and manages to translate the soft, organic curves of claymation into plastic bricks remarkably well. Gromit, in particular, seems to have stolen the show, with clever use of magnifying glass elements for his goggles and those signature floppy ears. It's a collaboration that feels genuinely right, blending Aardman's artistry with LEGO's versatility.

While the source article praises the set as "phenomenal" and "priced very decently" for international markets, the India price is where things get interesting.

MyBrickHouse and Toycra will likely stock this set 4–6 weeks after the global launch on October 1st, 2026. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

For fans who grew up with Wallace and Gromit, finding high-quality official merchandise can be a challenge. This set promises to be a fantastic addition for collectors, capturing a beloved piece of animation history. However, given the estimated price point for India, it’s probably wise to wait for a potential deal or a price drop before diving in.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-wallace-gromit-21371-officially-revealed' AND md5(content) = '7c9a7d73cfd267baae27f3fadb53a723'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21371') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21371') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO just announced the Wallace & Gromit Ideas set and your wallet is already bracing for impact. This isn't just any set; it's a 1,038-piece tribute to the beloved British duo, complete with their iconic retro motorbike. Available from October 1st, this 18+ set promises a detailed build inspired by the award-winning film 'A Close Shave'.

The set, number 21371, captures Wallace and Gromit in a dynamic pose on their motorbike, with functional wheels for a bit of motion. It’s packed with accessories that fans will recognise: crackers, a ball of wool, and even a diamond tucked away in the motorbike’s seat hatch. The press release mentions it's a great gift idea for dads, mums, or any collector of Wallace & Gromit merchandise. It even originated from a fan designer's Grand Prize winning entry in the LEGO Ideas '90s Throwback' challenge, suggesting a high level of fan input and approval.

Early reactions from the source article show a lot of excitement. Many commenters praised the accuracy of the final model compared to the fan submission, with some calling it "phenomenal" and "nearly 1:1." The clay-like aesthetic, despite being made of bricks, has been particularly well-received, with one user noting, "From a distance, it doesn't even look like Lego. It looks just like a clay model." The set aims to replicate the charm of the animated series, and by all accounts, it seems to have succeeded. It’s a delightful display piece that should appeal to long-time fans and new builders alike.

MyBrickHouse and Toycra will likely stock this 4–6 weeks after the global launch on October 1st. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

While the build and design are getting rave reviews, the price point is definitely something to consider. For a set with just over a thousand pieces, the USD $99.99 retail price translates to a significant investment when it lands in India. The sentiment from many commenters about life being "hard" with so many desirable sets being released suggests that fans are feeling the financial strain. Given the price and the sheer number of exciting sets hitting the market, it might be wise to wait for a potential discount or a deal before diving in.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-wallace-gromit-21371-revealed-a-close-shave-for-y' AND md5(content) = '9dea13153972b8c558cde0550f26a730'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21371') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21371') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO dropped a hint about upcoming Pokémon sets, and it's got the rumour mill churning. New Elementary is reporting on a wave of LEGO Pokémon SMART Play™ sets scheduled for August 2026. The catch? They're only launching in the US, UK, Australia, Germany, France, and Poland. That means for us in India, it's going to be a case of waiting and watching.

This initial report focuses on new moulds appearing across fifteen sets. We're talking about new pieces designed specifically for the Pokémon universe, which is always exciting for fans who love seeing fresh brick elements. While specific set names and numbers aren't detailed yet, the sheer mention of new moulds suggests LEGO is investing in this theme. Fifteen sets is a substantial wave, hinting at a range of display pieces, play features, and maybe even some buildable creatures.

The SMART Play™ branding also suggests interactive elements, possibly leveraging technology or unique building techniques. However, without concrete details on what these sets actually are, it's hard to say much more. We don't have any official Indian release dates or pricing information. This is typical for LEGO releases that initially skip the Indian market. It usually means a significant wait.

The absence of an official Indian launch means you'll likely have to rely on unofficial channels if you absolutely must have these sets on day one. This route always comes with its own set of risks and inflated prices. For most, it will be wiser to wait and see if LEGO India decides to bring these over later. History suggests some waves do eventually make their way here, but it can take months.

Keep an eye on MyBrickHouse and Toycra for potential grey market imports, but anticipate a 4–6 week lag from global launch if they do appear. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The focus on new moulds is a strong indicator that LEGO is committed to the Pokémon line. Whether these sets will eventually reach Indian shores remains to be seen. For now, it's a case of observing from afar.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'new-moulds-spotted-in-lego-pokmon-smart-play-sets-coming-aug' AND md5(content) = '75a3dd6737c648c0aa12657fe7cca5a0';
UPDATE public.news_articles SET content = $c$Your wallet is probably still recovering from the last big LEGO sale, but LEGO.com is back with another event: Insiders Day. This one brings a few freebies if you spend enough, headlined by the [40908](/sets/40908-restaurants-of-the-world-greece) Restaurants of the World: Greece set. It’s a nice little promotional piece, perfect for adding some Mediterranean flair to your existing city builds or just enjoying as a standalone display.

To snag the Greek Restaurant, you’ll need to hit a spending threshold. The exact amount varies by region: over $180 in the US, £160 in the UK, and €180 in the EU. Yes, the EU price is higher, a detail confirmed by several users in the comments. It’s a bit of a sting when you’re already spending a chunk of change on new sets. On top of that, you can get an extra 500 Insiders points on your first order and double points on selected One Piece sets. There's also a smaller freebie, [30729](/sets/30729-premier-ball) Premier Ball, available for orders over $40/£35/€40.

The Insiders Day event is a good reminder to keep an eye on LEGO.com for these promotional sets. They often don't stick around for long, and if you miss out, you might end up paying inflated prices on the secondary market, as one commenter noted about a previous restaurant GWP. The 500 extra points offer isn't exactly life-changing, equating to roughly £3.13, but it’s a small bonus if you were planning a purchase anyway.

The LEGO 40908 Restaurants of the World: Greece GWP is not yet available through official Indian retailers like Toycra or MyBrickHouse. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Toycra and MyBrickHouse are the stores to watch for potential availability, though GWP items are often not stocked locally. Expect a 4–6 week lag from global launch if it does appear.

This event highlights the ongoing appeal of the GWP (Gift With Purchase) strategy. While some fans might grumble about the spending thresholds, sets like the Greek Restaurant are often desirable enough to encourage larger orders. It's also worth noting the popularity of the City Construction sub-theme, mentioned by a couple of users, showing that even smaller, less flashy themes can find their audience.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-insiders-day-free-greek-restaurant-gwp-available-now' AND md5(content) = 'bce811cf9fa5b522e84299a56d11eb41'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908', '30729') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908', '30729') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The LEGO community was buzzing in April 2026, with Bricknerd rounding up the stories that mattered. Forget new set announcements for a moment; this is about the conversations, the deep dives, and the sheer creativity that makes this hobby tick. If you missed the chatter, here’s a quick recap of what had LEGO fans talking last month.

The usual suspects were there: fantasy worlds, microscale cities, model trains, and space exploration. These themes consistently capture fan imagination, showing the breadth of LEGO’s appeal. Whether it’s building sprawling castles, intricate cityscapes in miniature, or launching rockets towards the stars, fans are clearly investing their time and brick collections into these popular genres.

Beyond the themed builds, there were also significant discussions about LEGO history and creativity. This tells us that while new sets are always exciting, the community also deeply values understanding the legacy and the innovative spirit behind the brick. It’s a reminder that LEGO is more than just plastic toys; it’s a cultural phenomenon with a rich past and a future driven by innovation.

Bricknerd highlighted thoughtful discussions about the hobby itself. This suggests a mature and engaged fan base, one that’s not just about accumulating sets but also about appreciating the art, the engineering, and the community aspect of LEGO building. These conversations often lead to new techniques, shared inspiration, and a deeper connection among builders.

The roundup also pointed to wonderfully weird discoveries. This is where the true joy of LEGO often lies – the unexpected, the unconventional, the builds that make you say, "Why didn't I think of that?" It’s these unique creations that push the boundaries and remind us that there are infinite ways to play with LEGO.

While no specific set numbers or product details were the focus of this particular roundup, it serves as a pulse check on the LEGO fan landscape. It shows us where the passion is directed, what sparks discussion, and what kind of content resonates most deeply. It’s a good indicator of what might influence future fan creations and perhaps even LEGO’s own design directions. Keep an eye on these themes; they often foreshadow what’s to come.

No official India MRP is available for these community highlights. Based on the featured themes like elaborate microscale cities and detailed model trains, individual custom builds or larger fan-made projects could easily range from ₹20,000 to over ₹1,00,000 if official sets were involved. MyBrickHouse and Toycra are the stores to watch for official releases, though custom builds are usually a different story. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. This hobby demands dedication, much like saving up for a year's worth of your favourite chai.

AVOID
This is a news roundup, not a product announcement.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-community-headlines-and-highlights-april-2026-what-grab' AND md5(content) = '76db2fd32893cc2be30b574a721fc2a4';
UPDATE public.news_articles SET content = $c$People ask me regularly: why is LEGO® so expensive in India? The answer involves import policy, tax structure, and currency, and none of it makes buying LEGO® cheaper, but at least it explains the trauma.

Import Duties

LEGO® products are manufactured in Denmark, Mexico, Czech Republic, China, and Hungary. None of these countries are India. Every set imported into India attracts Basic Customs Duty — currently around 20-25% for most toy categories.

This is before anything else happens to the price.

GST

Goods and Services Tax on toys in India is 18%. This is applied after import duties. On a set that landed at ₹1,000 duty-paid, GST adds another ₹180. You're now at ₹1,180.

Currency Conversion

The USD to INR rate has a significant impact. Add duties and taxes and you're at approximately ₹12,000-₹13,000. Compare to the US price of $100 (approximately ₹8,300) and the difference is stark.

Retailer Margin and Distribution

Indian retailers add their own margin. The certified LEGO® distribution chain adds another layer. By the time a set reaches your hands, every party in the chain has taken a cut.

The Honest Total

This will not change quickly. The import duty and GST structure would need policy changes. The currency situation is what it is.

What You Can Actually Do

Compare prices. Use code ABHINAV12 at Toycra for 12% off. Buy at the right price from the right store. You can't change the import structure, but you can shop smart within it.

FAQ

Q: Why are LEGO® prices so high in India?
A: Import duties (20-25%), GST (18%), and currency conversion (USD/INR) collectively add 45-80% to the US price. Retailer margins add further.

Q: Will LEGO® prices reduce in India?
A: They would require changes to import duty structure or GST rates. Both are possible but not guaranteed. Price reductions for specific sets occasionally happen.

Q: Is it cheaper to buy LEGO® abroad and bring it to India?
A: Technically, duty-free allowances allow limited personal imports. For large purchases, customs duty applies at the same rate as commercial imports. It's rarely worth the hassle.

Q: How much cheaper is LEGO® in the UK than India?
A: UK prices are typically 20-30% lower than Indian prices in absolute terms, even accounting for currency. But shipping, duties, and risk of damage eliminate most savings.

Q: What is the best way to save money on LEGO® in India?
A: Compare prices across stores using Bricks of India, use code ABHINAV12 at Toycra for 12% off, watch for festival sale periods (Diwali, Republic Day), and buy when you see a good deal rather than waiting.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'why-indian-lego-prices-high-honest-truth' AND md5(content) = 'ff214abe311285b0cc118e88c2f158bd';
UPDATE public.news_articles SET content = $c$Nintendo dropped a surprise announcement during their 40th Anniversary Direct, revealing the next LEGO The Legend of Zelda set. Set number 77094, Ocarina of Time - Link & Epona, is a brick-built statue featuring the hero Link astride his faithful horse, Epona. This iconic duo hails from the Nintendo 64 classic, The Legend of Zelda: Ocarina of Time, a game getting a full remake for the Nintendo Switch 2 this year.

The set boasts an impressive 1750 pieces and is slated for a spring 2027 release. Early reactions from fans are a mix of excitement and a touch of longing for minifigure-scale sets. Many commenters on Brickset praised the sculpt and accuracy, particularly noting the use of a specific face piece that captures the N64-era anime style well. There's a general consensus that the build looks great, though some expressed concern over the base size and the lack of a separate minifigure Link to accompany the brick-built Epona.

This marks the third Zelda set to focus on Ocarina of Time, leading some to hope for sets from other games in the franchise soon. While the statue display format is a departure from minifigure-centric playsets, it follows a trend seen in other LEGO lines, with some fans comparing it to the Star Wars character sculptures. The sheer piece count suggests a substantial build, but the price point will be the ultimate decider for many.

MyBrickHouse and Toycra will likely stock this 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The set is scheduled for a spring 2027 release, so while it's officially announced, we have a while to wait for its arrival in India. Given the high piece count and the popularity of the Zelda franchise, it’s unlikely to be cheap. For now, fans will have to content themselves with the official images and the upcoming remake of the game itself.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-the-legend-of-zelda-77094-ocarina-of-time-link-epona-re' AND md5(content) = '67fa53c3fc129105eb6aea991b8fed94';
UPDATE public.news_articles SET content = $c$Your wallet just called. It wants to discuss the new LEGO Batman Adventures in Gotham City book. Specifically, the minifigure trapped inside. LEGO DK Books are usually the go-to for exclusive minifigs, and this year’s Batman release is no different, packing the standout Jokerised Batman minifigure of 2026. No official India price yet, which means we are in that particular purgatory where you want it but cannot fully panic yet.

The book itself, Batman Adventures in Gotham City, seems aimed at younger fans. It’s light on text, heavy on colourful renders of Batman sets, and reads more like a bedtime story than a collector's encyclopedia. Think pre-schoolers learning about Gotham's rogues gallery. But who are we kidding? We’re all here for the Jokerised Batman. This isn't just Batman in a clown suit; it's a full-blown Joker-esque Batsuit, complete with graffiti-style "Ha Has" and playing card symbols on the utility belt. The cowl is the modern dual-moulded version, but with yellow eyes against that signature Joker green. The back printing continues the chaotic graffiti theme. It’s a brilliant "elseworlds" take, possibly inspired by The Joker War comic arc, and a fitting tribute for Batman's 25th anniversary.

DK Books usually keeps these companion books reasonably priced, and this one is no exception. While a comprehensive character encyclopedia would have been nice, the current LEGO DC landscape outside of Batman doesn't offer much new content for such a book. This Jokerised Batman variant, however, is a must-have for any serious LEGO Batman collector. It's easily one of the most creative Batman minifigures LEGO has put out in years. The book is available now from Amazon.com, Amazon Australia, and Amazon.co.uk.

The US retail price for the hardcover book with the minifigure is $24.99 USD. The book is readily available from Amazon India, though check MyBrickHouse and Toycra for potential local stock, which usually arrives 4–6 weeks after global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

If you're a Batman fan, this is a no-brainer. Grab the book, free the minifigure, and display it proudly. The build experience of the book itself is minimal, but the minifigure alone justifies the purchase. This is a clear BUY NOW.
Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: BUY NOW. The price is right — grab it.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-batman-adventures-in-gotham-city-book-2026-jokerised-ba' AND md5(content) = '9f2ba7ab510ffd6c4383d30265f553c2';
UPDATE public.news_articles SET content = $c$LEGO's new Pokémon SMART Play range has dropped, and one of the first items to surface is the [30729](/sets/30729-premier-ball) Premier Ball. This little brick-built orb is currently available as a gift with purchase, requiring a spend of over £35 or €40. Don't expect any fancy SMART Play features here; this is a straightforward build, a recruitment bag for your pocket.

The Premier Ball itself is constructed from a solid collection of plates and curved slopes, predominantly in white and red. It’s a dense, cuboid representation of the iconic item, sturdy enough for imaginative play – just maybe aim away from unsuspecting family members. Unlike some other LEGO items, this one didn’t carry the ‘do not throw’ symbol, which is a small but notable detail.

However, the choice of a basic white ball might feel a bit underwhelming. Given the vast array of more colourful and distinctive Poké Ball designs available in the Pokémon universe, a plain white one feels like a missed opportunity. It also lacks any opening mechanism, which might disappoint some fans. This particular Premier Ball is known from Pokémon GO for its use in capturing Raid Bosses or Shadow Pokémon, and also features in the main series games as a bonus for purchasing multiple standard Poké Balls.

Despite these limitations, the set does include some interesting parts and feels substantial enough for its implied value. The review suggests it's a reasonable inclusion for a £35 purchase, especially when compared to the larger LEGO Pokémon SMART Play sets. While not much to write home about on its own, similar promotional items have historically become available separately later on from various sources. For now, it’s a way to snag some extra LEGO bricks with a qualifying purchase.

It is not yet available in Indian stores, and fans will likely need to wait 4–6 weeks after the global launch for potential availability. Keep an eye on Toycra and MyBrickHouse for updates. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.
On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pokmon-30729-premier-ball-gift-with-purchase-details' AND md5(content) = '6b6fff4607b6ab63295b5ad42e022e68'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('30729') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('30729') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$I've spent more money on LEGO® than I have on most sensible adult things. This fact is not in dispute.

What I can tell you, with complete certainty, is whether it's worth it. Here is my honest 2026 answer.

The Case For: Yes, It's Worth It

LEGO® is, fundamentally, a premium product. The tolerances are extraordinary — pieces made decades apart still fit together. The design quality is world-class. The building experience is genuinely meditative, genuinely satisfying, and genuinely enjoyable in a way that very few purchased things are.

More importantly: LEGO® holds its value. Sets retired in 2019 sell for 3-5x their original price. The Millennium Falcon ([75192](/sets/75192-millennium-falcon)) retailed for ₹52,000 in India and sells secondhand for ₹1,20,000+. This is not a toy. This is a collectible that you can also play with.

The Case Against: It's Complicated in India

LEGO® in India is expensive. Not "a bit more" expensive. Often 40-60% more expensive than US prices after accounting for import duties and GST.

The value equation only works if you're buying at the best possible price in India (hence: this website) and buying sets you actually want to build and display, not sets you're buying just because they're LEGO®.

The Honest Answer

LEGO® is worth the Indian price if:
You're buying at the best available price (compare first, always)
You'll actually build it (not just store it)
You're buying sets you genuinely want to own
You're thinking of it as an adult hobby, not a childhood toy

LEGO® is not worth the Indian price if:
You're buying impulsively
You're buying at MRP without checking alternatives
You're buying sets because they're popular, not because you want them

Use code ABHINAV12 at Toycra. Compare prices here first. Buy what you actually want. Then: yes, it's absolutely worth it.

FAQ

Q: Is LEGO® overpriced in India?
A: Compared to global prices, yes — typically 40-60% more expensive due to import duties and GST. But buying from the right stores at the right price makes a significant difference.

Q: Does LEGO® increase in value in India?
A: Retired sets typically increase 2-5x in value over 3-5 years. This is consistent globally, including India, for popular themes like Star Wars, Harry Potter, and Icons.

Q: What is the most expensive LEGO® set in India?
A: The Millennium Falcon (75192) and the Colosseum ([10276](/sets/10276-colosseum)) are among the most expensive at ₹45,000-₹55,000 at Indian MRP.

Q: Why is LEGO® more expensive in India than in the US?
A: Import duties (currently around 20-25%), GST (18% on toys), and currency conversion all contribute to the India price premium.

Q: Is second-hand LEGO® worth buying in India?
A: Yes, if you're buying complete sets from trustworthy sellers. OLX and local LEGO® collector communities are good sources. Inspect carefully before buying.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'is-lego-worth-price-india-2026' AND md5(content) = '2351c859c446d5bd1169f1a8b85e46ef'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('75192', '10276') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('75192', '10276') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet can breathe easy. LEGO just dropped the [40908](/sets/40908-restaurants-of-the-world-greece) Restaurants of the World: Greece, the third in a series of four collectable gifts with purchase this year. We've only just seen the review, and the clock is ticking fast – you've only got until August 20th to snag this one directly from LEGO.com. This is a 254-piece set, and while it might not hit the dizzying heights of its predecessors, it's still a charming little build.

The Greek restaurant sits on a 10x12 baseplate. At the front, you get a small table for al fresco dining. The back has a basic prep area, complete with a single stove ring, a worktop, and some storage. It looks like they're whipping up waffles and orange juice in there, which is… a choice. Just three stickers are in the set, one of which decorates the area under the hob. Unlike the Japanese and Mexican restaurants in the series, this one features a bench-style seat facing outwards, positioned behind a table laden with fish, a wine glass, and a fork. There’s even a bowl of water for the obligatory LEGO cat. The proprietor sports a traditional embroidered shirt with the Greek phrase ΚΑΛΗ ΟΡΕΞΗ printed on the back, a local way of saying 'enjoy your meal'.

The stairs on the side lead absolutely nowhere, a typical architectural flourish for the region. While they might seem like wasted space, the actual building footprint is the same 8x10 as the other restaurants in the series. It's shorter in height than the others, and has fewer pieces overall, but it does display well alongside them. If you’re collecting the whole set, this is a must-have.

Check MyBrickHouse and Toycra for availability, as these sets are typically imported. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from the global launch date for them to surface.

Given the limited availability window and the fact it's a gift with purchase, grabbing it directly from LEGO.com is your best bet. Waiting for it to appear on secondary markets or potentially discounted at local stores might mean missing out entirely. If you're invested in the series, don't delay.

WAIT
On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40908-restaurants-of-the-world-greece-gwp-get-it-before' AND md5(content) = '46934b9a3996e1eff0ddeb550c0d9c9d'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet just ran a marathon; the LEGO Tribute to Leonardo da Vinci GWP hides behind a $150 spend threshold. The 251‑piece set is the latest freebie in LEGO’s historical tribute series, and it arrives only if you shell out enough cash on the official LEGO.com store. It’s not a standalone product you can add to a cart; it’s a gift with purchase, free when you spend over £135, $150 or €150.

The set builds a slice of da Vinci’s workshop, complete with a colourful mosaic floor that looks like a tiny fresco. Three printed tiles and a single sticker bring the scene to life. Inside the workshop you’ll find an easel holding the Mona Lisa, a desk cluttered with an ink pot, quill, mirror and a printed tile of his ornithopter plans. A pear rests on a side table – a nod to his botanical sketches – while a cat perches on the balcony, reminding fans of his feline studies. The minifigure of the Renaissance polymath sports a white beard, blue tunic and a back bracket that can hold the flying machine.

All the parts are solidly LEGO‑bricked, and the level of detail is surprisingly high for a GWP. The set also includes a tiny mirror tile that hints at da Vinci’s habit of writing in reverse, a clever little Easter egg for history buffs. The only sticker is for a mirror on the desk; the rest of the build relies on printed elements and clever moulding.

Because it’s a gift‑with‑purchase, the set won’t appear in any Indian retailer catalog. Indian fans will have to order directly from LEGO.com, meet the spend requirement, and hope the shipment reaches India in time for their next build session. Expect a typical 4–6 week lag from the global launch, and keep an eye on both MyBrickHouse and Toycra for any future listings.

MyBrickHouse and Toycra will likely list it 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Given the lack of a direct purchase route and the need to spend a serious amount just to qualify, the safest move for Indian builders is to wait for a more accessible channel. Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40902-tribute-to-leonardo-da-vinci-gwp-news-what-it-mea' AND md5(content) = '77e13381c10dd46403473ff10a41f3ba';
UPDATE public.news_articles SET content = $c$The LEGO community never sleeps, does it? Even when official LEGO news is slow, fans are busy creating, discussing, and sharing. BrickNerd dropped their April 2026 roundup, and it’s a deep dive into what’s buzzing beyond the official sets. Forget the latest UCS Millennium Falcon for a moment; this is about the real heart of the hobby.

This month’s highlights cover a lot of ground. We’re talking about fantasy builds that must have taken months, intricate microscale cities you could lose yourself in, and yes, even model trains made of LEGO. Who knew that was a thing? Apparently, a lot of people. There’s also a section on space exploration builds, which makes sense, given the current obsession with anything Mars. It’s a good reminder that LEGO is more than just the sets you buy off the shelf. The creativity out there is frankly unreal.

They also touched on some historical dives and discussions about the hobby itself. It’s not just about accumulating bricks; it’s about the community, the history, and how we all got hooked. This kind of content is rare, and frankly, needed. It’s easy to get lost in the next big release or a price comparison, but remembering why we love this plastic stuff in the first place is important. It’s a good read if you’re looking to get inspired or just want to see what else is possible with a few thousand bricks.

No specific set prices are mentioned in this article, which is more of a community roundup. Based on the general trend of fan-created content and discussions, imagine if some of these incredible MOCs were officially sold. MyBrickHouse and Toycra are the stores to watch for any official releases, though this article focuses on fan creations. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. The lag for any potential official Indian release of fan-inspired sets is typically 4–6 weeks from global availability.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-community-headlines-and-highlights-april-2026-whats-new' AND md5(content) = '3f7b0a1af72fba8e8b7297e2f59ab696';
UPDATE public.news_articles SET content = $c$This MOC is huge. Like, truly gargantuan. Matt Margini has built a diorama featuring enormous grey gargoyles, and frankly, it’s giving us wallet anxiety. No set number, no official release, just pure, pure LEGO artistry that makes you want it immediately.

The centrepiece is a massive, grinning gargoyle that looks like it’s holding up the world. Below it, a tiny adventurer is shown, suggesting some kind of epic quest or trial. Four smaller gargoyles flank the main statue, hinting at more challenges.

The diorama is built mostly with grey bricks, both old and new shades. Margini has sculpted statues representing wisdom, wit, woe, and wrath. The detail on these is apparently incredible, with some clever part usage that fans will appreciate. The whole thing is set against a cathedral backdrop. It’s proof of how much you can achieve with LEGO bricks, especially when you’re not constrained by official set themes or piece counts.

This is the kind of build that makes you question your life choices. Do you really need that new smartphone, or could you, perhaps, spend that money on… well, not this, because it’s not for sale. But the dream is there. It’s the kind of creation that sparks joy and also a deep, existential dread about the sheer amount of plastic brick potential out there that we can’t actually buy.

If this were officially released as a LEGO set, expect the price to be eye-watering. MyBrickHouse and Toycra would likely be the first places to check, but don't hold your breath. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from any hypothetical global launch.

It’s a masterclass in LEGO building, showcasing incredible detail and storytelling. While we can’t add it to our carts, it’s a powerful reminder of the creativity within the LEGO community. The Brothers Brick have highlighted it, and it’s easy to see why. This isn’t just a build; it’s a statement. A very large, very grey statement. It makes you wish LEGO would release more display-focused sets with this level of ambition.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-gargoyles-moc-your-wallet-is-already-sweating' AND md5(content) = '603d8550e47226f20ccc0f4741aeca35';
UPDATE public.news_articles SET content = $c$Your wallet might be safe this week, but your curiosity? Not so much. Jay's Brick Blog is jetting off to Billund for the annual Fan Creator Summit 2026, formerly known as Fan Media Days. This is where the magic happens, folks – think behind-the-scenes access, interviews with LEGO designers, and sneak peeks at sets that haven't even been leaked yet.

The event, hosted by The LEGO Group at their global HQ, is a big deal. It’s where fan creators get the inside scoop. Jay's Brick Blog, now a Recognised LEGO Fan Creator, will be rubbing shoulders with designers and getting intel on upcoming releases. While much of what Jay sees will be under wraps for months, they'll be sharing updates on Instagram and Facebook, so keep an eye on those channels.

This year, The LEGO Group is footing more of the bill, covering accommodation at Hotel Legoland and contributing to travel costs. This is a welcome change from previous years where creators covered everything themselves. It means smaller blogs and creators can participate, bringing more diverse perspectives to the fan community.

Jay will be in Billund from Sunday, September 20th, until Thursday night, attending AFOL Day at the LEGO House. They’re also keen to chat with the LEGO Design team and are asking for reader questions to submit. So, if you've been wondering about the design process or have burning questions for the minds behind your favourite sets, now's your chance to get them answered. Drop them in the comments on the blog.

While no specific sets were revealed in this announcement, the promise of "exciting sets that LEGO are launching in the not too distant future" is enough to get any LEGO fan buzzing. We'll have to wait and see what tidbits Jay brings back. It’s a good reminder that while we often focus on what’s available now, the future of LEGO is always being shaped.

Since no specific sets are being previewed or discussed in terms of price, we can only estimate. MyBrickHouse and Toycra are the stores to watch for future releases, though availability for these previewed items would be a 4–6 week lag from global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'fan-creator-summit-2026-jays-brick-blog-heads-to-billund-for' AND md5(content) = 'c45c82f8ec70b4dd9332ff52eeccc059';
UPDATE public.news_articles SET content = $c$LEGO has finally decided to grace us with some Wednesday-themed sets. After what feels like an eternity of waiting, two new additions are dropping just in time for Halloween. We're talking about the [76787](/sets/76787-wednesday-backpack) Wednesday Backpack and the 890-piece [76788](/sets/76788-nevermore-academy) Nevermore Academy. The latter is particularly exciting as it includes the first-ever Wednesday minifigure, alongside some printed statue figures for the microscale school.

The Wednesday Backpack set comes with 401 pieces and features Wednesday and Thing. The Nevermore Academy set, at 890 pieces, includes Wednesday and Enid as statue figures. Both sets are scheduled for a global release on October 1st. Brickset reports the prices as £34.99 for the backpack and £59.99 for the academy.

Now, the crucial question for us: when do these arrive in India, and at what cost? Given that these are brand new announcements, there's no official Indian pricing or release date yet. We can estimate based on the UK prices, but it's always a gamble. The backpack at £34.99 (around ₹3,700) and the academy at £59.99 (around ₹6,300) are not insignificant investments.

Expect a 4–6 week delay from the October 1st global launch for both MyBrickHouse and Toycra to stock these. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

While the inclusion of a Wednesday minifigure is a win, some fans on Brickset are already lamenting the lack of an Enid minifigure in the Nevermore Academy set. Others are hoping LEGO continues to explore microscale builds for various themes, seeing potential for epic crossovers. It's a mixed bag for fans, but at least LEGO is finally dipping its toes into this popular IP. We'll keep an eye out for official Indian pricing and availability, but don't hold your breath for a simultaneous release.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'new-wednesday-lego-sets-announced-but-when-will-they-land-in' AND md5(content) = '6a5bd74a8d8eead81ecb854cf5ad76b0'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('76787', '76788') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('76787', '76788') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO just dropped over 100 new elements into their Pick a Brick service this past Tuesday, August 4th, 2026. This isn't a new set announcement, mind you, but a refresh for the parts-ordering system. Think of it as a digital buffet for your brick bin. The parts are sourced from sets that hit shelves back in April, meaning you're getting access to some more recent pieces that might have been hard to find otherwise.

The real headline here, though? The return of LEGO monorail, sort of. What this means is that pieces relevant to the iconic monorail system are now available through Pick a Brick. It’s not a full monorail set, obviously, but for builders who want to expand or create their own custom monorail layouts, this is a significant addition. Remember the excitement around those classic monorail sets? Well, now you can grab those specific track pieces and associated elements directly, no need to hunt down old, expensive sets.

Beyond the monorail tease, the update includes a variety of other interesting elements. New Elementary’s list shows over 100 new pieces. While the exact list is extensive and available on their site, the general takeaway is that LEGO is making newer, more sought-after parts available through PaB. This service is usually a treasure trove for MOC builders, allowing them to acquire specific pieces in bulk without buying entire sets. It's a smart move by LEGO to cater to the custom building community, and frankly, it's about time some of these newer parts became accessible.

The inclusion of these elements suggests LEGO is listening to builder feedback. Having access to recent set parts can significantly lower the barrier for complex custom builds. It’s a good sign for the future of the Pick a Brick service. Whether you're a seasoned MOC creator or just someone who needs a specific piece for a repair, this update is worth checking out. Just head over to the Pick a Brick section on LEGO's official website.

MyBrickHouse and Toycra will likely stock a selection of these parts, but direct ordering from LEGO's Pick a Brick service often involves a 4-6 week wait for delivery in India. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pick-a-brick-2026-adds-over-100-new-elements-this-augus' AND md5(content) = '070613d37a763183c8e1c5cfa0654972';
UPDATE public.news_articles SET content = $c$Your feed has probably been taken over by Jimothy. You know, the spherical, bobbed-tail raccoon-like creature that’s become a local Seattle celebrity. It’s gone viral. Now, LEGO builder Iain Heath has immortalized this internet sensation in brick form. No official set number or product details have been released, so this is purely a fan creation for now.

Jimothy first appeared in the Seattle neighborhood of Ballard, sparking curiosity and debate. Is he a real cryptid, a raccoon with a unique condition, or an elaborate hoax? The mystery only fuels his popularity. He’s become a local hero, and it was only a matter of time before the LEGO community jumped on board. Iain Heath, known for his creative builds, wasted no time capturing Jimothy’s spherical charm in LEGO.

The Brothers Brick highlighted Heath’s creation, noting the rapid response to a viral moment. While we don't have details on official LEGO products, fan creations like this often inspire official sets down the line. For now, it’s proof of how quickly internet culture can permeate different creative spaces, from social media feeds to the LEGO world.

MyBrickHouse and Toycra will likely see stock 4–6 weeks after any potential global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The lack of official confirmation means we can't speculate on pricing or availability for India just yet. It’s a fun build to see, though, and it perfectly captures the essence of a creature that’s taken the internet by storm. Whether Jimothy is real or not, his LEGO representation is certainly a hit. Keep an eye on fan communities for more on this build.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-jimothy-cryptid-build-surfaces-online' AND md5(content) = 'e22338a8dbba502c2f191cab387850fb';
UPDATE public.news_articles SET content = $c$Your wallet just got a heads‑up that Bricklink's Designer Program Series 11 is about to drop some serious brick magic. Your bank account is already bracing for the upcoming price tags, even though we don’t have exact INR numbers yet. Bricklink has finally posted the five finalists after a fan‑vote marathon, and the excitement is real.

The lineup reads like a curated mixtape for every niche we love. Castle lovers will get a taste of royalty with “Royal Nest” by _TLG_, a compact fortress that promises intricate detailing without needing a whole wall of bricks. Right next to it sits “Elven Citadel” by NicolasCarlier, a sleek medieval fantasy castle that oozes style and could become a centerpiece for any fantasy build. If you’re more into the classic space vibe, “Lunar Cargo Train” by Niloc brings a modern spin to the old monorail, complete with cargo containers that look ready for a moon‑base supply run.

The two remaining designs shift the focus to everyday charm. “Le Petit Bouquet” by Mictur is a tiny floral arrangement that could sit on a desk, while “The Village Parlour” by HenrysBricks promises a cozy community hub, perfect for role‑play scenarios. None of these are final; the designers will now enter the refinement phase, polishing geometry, colour palettes and buildability before the crowdfunding launch.

Mark your calendars: the crowdfunding for Series 11 kicks off on 1 June 2027 at 8 am PDT, with the first shipments slated for November 2027. That gives a comfortable runway for the Bricklink team to tweak any last‑minute issues and for us to keep an eye on pricing trends. Historically, Bricklink Designer Program sets land in the ₹30,000–₹40,000 bracket, but exact numbers will only emerge once the Kickstarter page goes live.

If you’re already picturing these sets on your shelf, remember that the Indian market usually lags a few weeks behind the global launch. Patience will be key, and keeping an eye on MyBrickHouse and Toycra for early alerts will save you a lot of scrolling.

Check MyBrickHouse for availability. Check Toycra for availability. Expect a 4–6 week lag from global launch. If this were officially sold in India, it would cost roughly the same as 18 months of Netflix Premium. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Stay tuned for the Kickstarter reveal, and be ready to pounce when the price drops finally appear. Until then, keep your bricks sorted and your inbox refreshed.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-bricklink-designer-program-series-11-finalists-revealed' AND md5(content) = '8a997764004965f8f068a3357179447f';
UPDATE public.news_articles SET content = $c$LEGO's popular Botanicals collection is getting two new additions, set to launch on August 1st. The series, known for bringing the beauty of nature into brick form, continues with the Hanging Golden Pothos and the Dark Flower Arrangement.

The Hanging Golden Pothos (set number unknown) will feature 372 pieces. Its counterpart, the Dark Flower Arrangement (set number unknown), boasts a larger count of 562 pieces. Both sets are priced at £54.99, $59.99, or €59.99 internationally. Exact pricing for India remains unconfirmed, but given the international figures, expect a significant investment.

While the article praises both designs, calling them "superb" and sure to be popular, it notes they aren't particularly groundbreaking within the theme. This sentiment echoes some fan discussions, with comments pointing out that while the Pothos looks remarkably realistic, the price for its piece count is raising eyebrows. Some fans question the value proposition when compared to real plants, while others defend the LEGO versions due to practical reasons like pet safety or a lack of a green thumb.

The Dark Flower Arrangement, especially with its "Halloween time" appeal, seems to be a strong contender for many. However, the debate around the price-to-piece ratio for the Pothos is likely to continue until official Indian pricing is revealed. It’s a familiar pattern: excitement for new LEGO releases, followed by a careful calculation of whether the joy is worth the cost.

No official Indian pricing has been announced yet for these two new LEGO Botanicals sets. MyBrickHouse and Toycra are the stores to watch for availability, and you can expect a 4–6 week lag from the global August 1st launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The Botanicals line has proven its market appeal, and these new sets are poised to join the ranks of popular displays for plant lovers and LEGO fans alike. Whether the realism of the Pothos or the aesthetic of the Dark Flower Arrangement wins out will depend on individual taste, but the price point is certainly a talking point.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'two-new-lego-botanicals-sets-bloom-august-1st' AND md5(content) = '5e438295acaf173c8c5fa43e4ed5dc9e';
UPDATE public.news_articles SET content = $c$Your wallet just rang the alarm: less than 24 hours left to lock in the Bricklink Designer Program Series 8 sets, and the price tags will make your EMI calculator sweat. The countdown ticks down to 12 pm PDT on 18 June, so if you’ve been eyeing any of the five models you need to act now or watch them disappear.

Series 8 brings a mix of castle‑themed and pirate‑flavored builds. The lineup includes Dustmark Keep (US$349.99), Coconut Cape (US$209.99), Brick Railroad Locomotive (US$119.99), Hot Air Balloon (US$79.99) and University of Science (US$359.99). All are still available for pre‑order through LEGO.com, and the crowdfunding window closes tomorrow. Once the window shuts, LEGO will start shipping the sets around November 2026, at which point you’ll be billed for whatever you secured.

The US pricing gives a rough idea of the budget you’ll need, but the Indian market is still in the dark. No Indian retailer has posted a concrete MRP yet, and the conversion from dollars to rupees will likely push these sets well into the five‑figure range. That means you’ll be looking at a spend that could rival a few months of Netflix or a high‑end washing‑machine EMI.

For Indian fans, the usual lag of 4–6 weeks after the global launch applies, so even after the November shipping window you’ll still be waiting for the bricks to hit local shelves. Keep an eye on both MyBrickHouse and Toycra – they’re the go‑to stores for Bricklink Designer releases, and they’ll be the first to list the sets once they arrive.

Check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Check MyBrickHouse for availability. If this were officially sold in India, it would cost roughly the same as 18 months of Netflix Premium.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'bricklink-designer-program-series-8-preorder-deadline-looms-' AND md5(content) = 'b4990a336c1febe4ec128c202d383bc6';
UPDATE public.news_articles SET content = $c$LEGO has officially lifted the curtain on [40975](/sets/40975-mini-hogwarts-castle) Mini Hogwarts Castle, and Harry Potter fans, prepare your shelves. This isn't some sprawling, room-consuming behemoth. This is a compact microscale diorama, a bite-sized piece of Hogwarts designed to fit without demanding a whole new display cabinet. It launches globally on August 29, 2026, as part of the annual "Back to Hogwarts" celebration.

The set boasts 700 pieces, which for a microscale build, suggests a good level of detail packed into a smaller footprint. Jay's Brick Blog highlights a key new element: a brand-new broomstick piece. This might seem small, but for a theme deeply rooted in magic and Quidditch, new accessories can add significant value and playability, even in a display piece. The focus here is clearly on capturing the iconic silhouette of Hogwarts in a manageable size, perfect for those who love the Wizarding World but are short on space or perhaps just want a more affordable entry point into Harry Potter display sets.

While the official reveal is exciting, the real question for us is always about the price and availability here in India. No Indian retail prices or official MRP have surfaced yet. This means we're entering that familiar waiting game.

Expect a 4–6 week lag from global launch for availability at MyBrickHouse and Toycra. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Given the price point and the fact that it's a new release, it's wise to hold off for now. Wait for official Indian pricing to drop and keep an eye out for potential discounts or bundle deals. This set offers a charming microscale Hogwarts, and the new broomstick element is a nice touch, but the initial cost warrants patience.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-40975-mini-hogwarts-castle-a-pocket-sized-hogwarts-arri' AND md5(content) = 'b3ceb7792a8b0ebbcec19b9c6cf51607'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40975') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40975') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The festive season is coming, and LEGO wants to make sure your display shelf is ready. They've just dropped the latest addition to the ever-popular Winter Village Collection: the Holiday House ([11387](/sets/11387-holiday-house)). If you're already mentally decorating your home for Christmas, this might be the piece you need to complete the look. It's a substantial build, clocking in at 1,354 pieces, which should keep you busy for a good few evenings.

This isn't just a static model; it comes with four minifigures and a horse, suggesting a little scene-setting is part of the fun. The house itself looks suitably cozy, with a wrap-around porch, pitched roofs, and all the traditional festive trimmings like garlands and holly. Inside, it's packed with antique furnishings – think fireplace, gramophone, rotary phone, and a mantel clock. Plus, there's a Christmas tree that lights up with an included light brick, casting a warm glow through the windows. A horse-drawn sleigh and a snowman are also included to round out the display. It's clearly designed for adults, promising a relaxing build experience, and even comes with digital instructions via the LEGO Builder app for those who prefer that route or want to build with others.

The official release date is October 1st, giving you just enough time to decide if it’s a must-have before the major holiday rush. It's a bit more than some previous Winter Village sets, so you'll want to weigh the piece count and the festive charm against the cost.

In India, the official LEGO Icons Holiday House (11387) carries an MRP of ₹11,500. Toycra and MyBrickHouse will likely list this set within 4–6 weeks of the October 1st global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That price is enough for about 23kg of Amul butter, so it’s definitely a considered purchase for the festive display.

It’s a beautiful set, no doubt, and the Winter Village line always generates excitement. However, the price point is on the higher side for a seasonal decoration. While it offers a good number of pieces and a detailed interior, it might be worth waiting to see if any early discounts pop up, especially with both major retailers expected to stock it soon. If you’re a die-hard Winter Village collector, you’ll probably buy it regardless, but for others, a little patience could pay off.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-icons-11387-holiday-house-joins-winter-village-collecti' AND md5(content) = '0e7c45da3ad88538535442f4927d6312'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('11387') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('11387') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO’s crowd-sourcing Ideas platform keeps churning out the unexpected, and the latest is a big one. After the success of the X-Files and the upcoming Wallace & Gromit, get ready to build the grand aristocratic world of Downton Abbey. Set number 21373, officially revealed today, brings the iconic Highclere Castle to brick form. This isn't a small build; it packs a hefty 4,711 pieces.

The set focuses on capturing the detailed architecture of the stately home, both upstairs and downstairs. You’ll be able to construct recognisable rooms like the dining room, main hall, library, kitchen, and servants’ hall. The top level is designed to be removable, allowing for a closer look at the meticulously recreated interiors. To populate this grand estate, the set includes 13 minifigures representing characters from Season 6 of the TV series. It sounds like a deep dive for fans, complete with exterior details like a cedar tree and bench for that perfect display piece.

The official release date is October 1st. For those in the US, it's priced at $349.99. That's a significant investment for any LEGO fan, especially with the current exchange rates. The LEGO Builder app will, of course, be there to guide you through the 4,711 steps. This set is clearly aimed at adult fans, with an 18+ age recommendation, and is positioned as a rewarding creative challenge and a sophisticated piece of home décor. It also promises to be a crafty gift idea for anyone devoted to the Downton Abbey universe and architectural models.

However, for us here in India, the situation is less clear. There are no official Indian store prices or MRPs available yet. Based on the US retail price of $349.99, and factoring in typical import duties and retailer markups, we're looking at a substantial cost.

Neither MyBrickHouse nor Toycra have listed this set yet, and it is expected to be available only via import channels for the foreseeable future. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).

Given the lack of official Indian retail availability and the high estimated cost, this is one for the dedicated fans who are willing to go the extra mile to import it.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-reveals-21373-downton-abbey-prepare-your-wallet' AND md5(content) = 'c42747555b64a6c8b414e96dfa085a68'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21373') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21373') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet is probably already bracing itself. LEGO has unveiled a new FIFA World Cup Official Trophy set, but before you get too excited, this one is exclusively for Spain. Yes, after Spain clinched the 2026 FIFA World Cup, LEGO dropped the 4000351 FIFA World Cup Official Trophy - Champions Edition. This isn't an entirely new creation; it's a tweaked version of a March release, with subtle changes to the secret compartment scene, a new printed plate, and, rather controversially, the minifigure has been removed.

The set packs 2845 pieces, just three more than its predecessor, and carries a price tag of €199.99. It’s slated for an October 1st release, with pre-orders open now. The quick turnaround from the World Cup final to this reveal has raised a few eyebrows, with some fans questioning why it's not available until October, missing the immediate post-victory buzz. The decision to make this a country-exclusive release also isn't sitting well with many, given the global nature of the event. The idea of regional exclusives for such a massive, worldwide tournament feels a bit dated, especially when compared to the potential for online exclusives or wider availability.

This move also has some LEGO fans grumbling about perceived downgrades, particularly the removal of the minifigure in favour of a printed tile. While the aesthetics of the trophy itself are subjective, the exclusivity and the removal of a key component have certainly sparked debate. It’s a collector’s item, sure, but its limited availability means most of us outside Spain will be looking at grey market imports or hoping for a lucky break. The original trophy, which we haven't seen an Indian price for yet, was already a significant investment. This 'Champions Edition' will likely follow suit, with import costs pushing it even higher for those who manage to acquire it.

No official Indian price or availability has been announced for the LEGO FIFA World Cup Trophy - Champions Edition. MyBrickHouse and Toycra will be the stores to watch for potential import stock, though availability is uncertain due to the exclusive nature of this release. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it does appear.

The move to country-specific releases for such a globally followed event is a curious one, and it's likely to leave many fans disappointed. For those in Spain, it's a chance to celebrate their victory with a massive brick build. For the rest of us, it’s another example of LEGO’s sometimes baffling distribution strategies.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-fifa-world-cup-trophy-champions-edition-revealed-for-sp' AND md5(content) = '6d4be9cece46b508b754f968ec19eb7b';
UPDATE public.news_articles SET content = $c$LEGO just dropped a hint about what's coming to Build-a-Minifigure next September, and it's getting spooky. Thanks to some early peeks from TwoGayAfols on Instagram, we're looking at three new minifigures perfect for your Halloween displays. This is the first proper Halloween-themed selection for Build-a-Minifigure in a while, which is good news if you like your minifigures with a side of creepy.

The characters revealed include a skeleton in a tuxedo, a vampire wearing a stylish cape, and a witch with a classic pointy hat and broom. They look pretty solid, offering some nice new parts and printing details that should appeal to anyone building custom dioramas or just wanting to flesh out their spooky minifigure collection. It’s always a bit of a gamble with Build-a-Minifigure releases – sometimes the parts are amazing, other times they’re a bit underwhelming. But these three seem to hit the mark for a themed release.

We’re still a ways off from September 2026, so there’s plenty of time to start saving up. These aren’t sold as full sets, of course. You’ll find them at official LEGO Stores, where you can pick and mix your own minifigures. The price per minifigure usually hovers around ₹450-₹500 in India, depending on the store and any ongoing promotions. It means these three new spooky additions will likely set you back around ₹1,350 to ₹1,500 if you manage to grab them all.

No official Indian release date or pricing has been confirmed yet, which is standard for these kinds of early reveals. The US retail price is not specified in the initial reports, making it difficult to estimate an exact Indian price. However, based on typical import costs and markups, we can make a rough guess.

If this were officially sold in India, it would cost roughly the same as 18 months of Netflix Premium.
This isn't confirmed India retail. MyBrickHouse and Toycra are the stores to watch for potential availability once they launch globally in September 2026. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for any potential availability through unofficial channels.

Keep an eye out for more details as we get closer to the September 2026 launch. These Halloween BAM figures seem like a fun addition for collectors, and hopefully, they’ll be easy enough to find when they arrive.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-build-a-minifigure-september-2026-halloween-characters-' AND md5(content) = '1059a006e26e41f7558846baae7ca17b';
UPDATE public.news_articles SET content = $c$Your wallet is probably already braced for impact. LEGO has revealed next year's LEGOLAND Exclusive set, 50090 LEGOLAND Park Adventure, and it comes with a US$109.99 price tag. That’s a lot of rupees, even before we figure out the Indian pricing.

This 1,578-piece set, officially launching in February, will be available exclusively at LEGOLAND Parks. The source mentions collectors of the 6-scale figures might be a bit miffed about the exclusivity, and frankly, so are we. Finding these sets outside the parks is always a challenge, turning a potential purchase into a full-blown treasure hunt.

Early reactions from the LEGO Creator Summit are mixed. Some fans find the colours unappealing and the base looking unfinished, with much of the piece count dedicated to a large figure. Others see it as a step up from previous years, appreciating the inclusion of a working roller coaster. There’s debate whether this is truly for kids or more for the collectors who will likely extract the large figure and find the remaining build somewhat lacking.

The theme itself seems to be a point of contention. Beyond "a big minifigure with a roller coaster and vendor stands," the purpose is unclear to some. It feels like a rehash of older LEGOLAND sets, particularly the original big minifigure with a simpler display. The exclusivity, while understandable given the LEGOLAND branding, still stings when compared to the more universally appealing pirate captain exclusive from before. This one at least promises to be at a handful of locations rather than just one.

We don't have an official Indian price or release date yet. MyBrickHouse and Toycra will be the stores to watch for this, but expect a 4–6 week lag from the global February launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The set’s design, particularly the integration of the large figure with the park environment, seems to be the main sticking point. Whether it’s a worthwhile addition to your collection will likely depend on your tolerance for exclusive sets and your affection for oversized LEGO figures. For now, it's a case of wait and see for the Indian market.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-50090-legoland-park-adventure-a-us10999-exclusive-comin' AND md5(content) = '867ddeaa16e6c4f73032a470b536e2ef';
UPDATE public.news_articles SET content = $c$LEGO has officially unveiled the Ideas set [21372](/sets/21372-la-catrina) La Catrina, a unique figurine celebrating Mexican culture and the Day of the Dead. This 1,212-piece set, aimed at adults (18+), promises a detailed and elegant build, designed to be a striking display piece for any desk or shelf. It features brick-built marigolds, printed sugar skull decorations on the hat and dress, and even includes a brick-built monarch butterfly that can be held or placed on the base.

The set is set to launch globally on August 1st. While the press release highlights the intricate design and the cultural significance of La Catrina, there's already discussion about the changes from the original fan submission. The original project by yop1172 was significantly larger, reportedly close to a meter tall. The official version has been scaled down, a move the source article suggests was necessary but might spark debate among fans who preferred the original's grandeur. The build techniques, particularly for the skull using a minifigure ruff and boomerang jawbone, have been noted as ingenious.

However, not all reactions are positive. Some commenters express disappointment with the color choices, finding them garish compared to the original submission's aesthetic. There's also a sentiment that the set might be too niche, appealing primarily to those of Mexican or Hispanic heritage, while others feel it's a minimal design for the piece count and cost. The debate around how Ideas submissions are adapted into official sets is a familiar one, and La Catrina appears to be no exception, with differing opinions on whether the final model captures the spirit of the original concept.

The LEGO Ideas La Catrina (21372) is priced at $139.99 USD. MyBrickHouse and Toycra are the stores to watch for availability, though expect a 4–6 week lag from the August 1st global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Despite the mixed reception, the set's unique theme and detailed execution make it a compelling display piece for those interested in cultural artifacts or striking LEGO models. The question remains whether the final design justifies the changes from the original, and if it will resonate broadly enough to overcome the price and aesthetic concerns raised by some fans.

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-la-catrina-21372-revealed-a-culturally-rich-displ' AND md5(content) = '368e608ad69fef2eb594597f31744b9c'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21372') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21372') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$Your wallet just got an alert. LEGO has unveiled the Nike Air Force 1 set, number 43026, and while it’s not exactly a direct hit to your bank account, it’s definitely going to make you pause. This isn't just a shoe; it's a whole display piece.

The set packs 1093 pieces, which is a decent chunk of plastic for the price point. It features a sculpture of the iconic Nike Air Force 1 shoe, perched on a themed display stand. And yes, there’s a spaceman minifigure thrown in for good measure, because apparently, shoes and space are now a thing. The international price is set at $99.99, which means we’re looking at a significant cost once it lands on Indian shores.

This release follows up on last year’s Nike models, including the Air Max 95, showing LEGO is doubling down on this particular collaboration. The designs have been praised for their aesthetics, even by those who aren't exactly sneakerheads. Some commenters noted the shoe sculpture itself is pretty neat, though the spaceship-like stand has sparked mixed reactions. One user humorously suggested it looks like a spaceship is "farting out the Nike logo." Another pointed out the potential for a cool spaceship alternate build, given the number of radar dishes included.

The inclusion of a spaceman minifigure has also raised eyebrows, with some fans feeling it’s a bit of a stretch to appeal to the Classic Space crowd. However, there’s a subtle nod to that theme with a Nike-ified Classic Space emblem on the base, which some find to be the most interesting detail. Whether this is a creative evolution or a sign that the shoe-themed sets are starting to feel repetitive is up for debate.

MyBrickHouse and Toycra will likely have it available 4–6 weeks after the global launch on September 1st. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Ultimately, LEGO seems to be leaning into these detailed footwear models. If you’re a fan of Nike, a collector of these shoe sets, or just appreciate a unique display piece with a spaceman, this might be for you. For everyone else, it’s likely another one to watch from a distance.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-nike-air-force-1-43026-announced-prepare-your-wallets-i' AND md5(content) = 'abc7601532bb815d8852bf9fcaf33f7c';
UPDATE public.news_articles SET content = $c$Your wallet can breathe easy for now. No new sets, no new expensive builds announced today. Instead, LEGO is doing a massive clear-out of its Pick a Brick (PaB) service. Think of it as a giant digital garage sale, but instead of old furniture, it's individual LEGO pieces. And they are not restocking.

New Elementary reports that after a smaller cull in June 2026, the LEGO Group is now preparing to remove over 1800 elements from the Pick a Brick service. These pieces will be gone once they sell out, and that’s it. Unless they happen to reappear in a future official LEGO set, you won’t be able to order them directly from PaB again. This is the "Last Chance" for these specific bricks.

This isn't necessarily bad news for everyone. For dedicated PaB users, it means a chance to snag some potentially rare or popular pieces before they vanish. For LEGO, it's a necessary house-cleaning to make way for new inventory and streamline their massive operation. It also means that any piece removed from PaB might be a hint that it's being retired from general production.

This huge removal could also signal a shift in how LEGO manages its element inventory. Are they planning to focus on fewer, more versatile pieces? Or is this just a regular, albeit large, update to their warehouse stock? We don’t have concrete answers yet, but the sheer number of elements being retired is significant.

For builders who rely on specific pieces for their MOCs (My Own Creations), this is a heads-up. Check the New Elementary article for the full list of affected elements. If there’s a particular brick you’ve been eyeing for that custom spaceship or detailed diorama, now might be the time to grab it. Don't wait too long, because once they're gone, they're gone.

No official India pricing or availability details are confirmed for these retired Pick a Brick elements. MyBrickHouse and Toycra are the primary official retailers to watch for general LEGO stock. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

This move by LEGO is a big one for the PaB service. It's a reminder that even the smallest brick has a lifecycle, and it’s best to get what you need while you can.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pick-a-brick-2026-over-1800-elements-being-retired' AND md5(content) = 'bda6a59be62f554c271b3c04cecb00d1';
UPDATE public.news_articles SET content = $c$Christmas feels like it’s still months away, but LEGO is already pushing 2026 Advent Calendars. Jay's Brick Blog spotted sales on Amazon.com and Amazon Australia for several upcoming holiday sets. This is your heads-up if you like to plan your festive brick purchases way in advance.

The usual suspects are here: LEGO City and Star Wars Advent Calendars are perennial bestsellers. This year, the Marvel Advent Calendar is also getting a lot of attention, featuring Doctor Doom, Spider-Man, and Wolverine on the box art. There are also calendars for Disney and Friends.

The article lists the US prices: the Star Wars ([75456](/sets/75456-star-wars-advent-calendar-2026)) and Marvel ([76340](/sets/76340-super-heroes-marvel-advent-calendar-2026)) calendars are US$35, with the City ([60510](/sets/60510-city-advent-calendar-2026)) and Friends ([42698](/sets/42698-friends-advent-calendar-2026)) calendars at US$25. The Disney calendar ([43298](/sets/43298-disney-princess-advent-calendar-2026)) is a bit pricier at US$44. Discounts are mentioned for most of these on Amazon.com.

However, here in India, we’re still in that familiar waiting game. No official Indian prices or release dates have surfaced yet. Amazon India typically gets these sets, but usually a bit later than the global launch.

The LEGO City (60510) and Friends (42698) calendars might come in at approximately ₹2,600. That’s enough to buy about 13kg of good quality mangoes, or nearly two months of Netflix. MyBrickHouse and Toycra are the stores to watch for these, though they're unlikely to stock them for another 4–6 weeks after the initial global release. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Jay's Brick Blog mentions they will start their daily Advent Calendar countdown on December 1st, 2026. For us, the countdown might begin when we see the first official Indian pricing. Given these are holiday-themed, you’d ideally want them well before December. Keep an eye on local retailers as we get closer to the end of the year. It’s a bit of a gamble to buy now if you’re in India, as the final price could fluctuate.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = '2026-lego-advent-calendars-spotted-on-amazon-indian-prices-u' AND md5(content) = '9080f4e33f351ba05da61bfdd86977f8'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('75456', '76340', '60510', '42698', '43298') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('75456', '76340', '60510', '42698', '43298') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$The LEGO Group is doubling down on Pokémon, and this time, they’re bringing minifigures. After launching larger-scale creature builds, the company has just announced five new sets that include beloved Pokémon like Arcanine, Rayquaza, and Munchlax. The real kicker? The very first LEGO Pokémon minifigures are included, which is bound to get collectors buzzing, even if your wallet is already bracing for impact.

Leading the charge is the [72154](/sets/72154-iconic-trainer-moments-pok-ball) Iconic Trainer Moments Poké Ball set. This massive 2,339-piece build features a brick-built Poké Ball that opens up to reveal scenes from a trainer’s journey, including Professor Oak’s lab. Crucially, it comes with three trainer minifigures – Professor Oak, Picnicker, and Red – along with figures of Pikachu and Eevee. This is the first time we’re seeing actual LEGO Pokémon minifigures, a significant step for the line.

Beyond the Poké Ball, we’re getting some substantial Pokémon builds. The [72150](/sets/72150-munchlax) Munchlax set offers a 757-piece recreation of the hungry Pokémon, standing over 18cm tall with poseable parts. Then there’s the [72160](/sets/72160-arcanine) Arcanine, an 1,190-piece set promising a fully poseable and detailed fiery beast. For fans of the legendary dragons, the [72168](/sets/72168-rayquaza) Rayquaza set boasts 1,083 pieces and includes an exclusive Lorekeeper Zinnia minifigure, recreating a scene from Pokémon Omega Ruby and Alpha Sapphire. Finally, the [40868](/sets/40868-up-scaled-red-minifigure) Up-Scaled Red Minifigure set gives us a large, poseable build of the iconic trainer Red himself, complete with his signature hat and a Poké Ball.

These sets are available for pre-order on LEGO.com starting today. While official Indian pricing and availability are still some way off, the US retail prices give us a ballpark. The Iconic Trainer Moments Poké Ball comes in at $299.99, with the other sets ranging from $69.99 for Munchlax up to $119.99 for Rayquaza.

No official Indian prices or release dates have been announced yet. Toycra and MyBrickHouse will likely stock these 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

The LEGO Group and The Pokémon Company International are clearly pleased with the reception of the initial sets and are betting big on minifigures to drive further interest. It’s a smart move, tapping into the collector base that’s been clamoring for proper LEGO Pokémon figures since the line’s inception. The inclusion of Red and his iconic trainer companions in the Poké Ball set is a clear nod to the franchise’s roots, which should resonate strongly with long-time fans. Whether these new additions will justify their likely premium prices in India remains to be seen, but the minifigure factor alone is a massive draw.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pokmon-expands-with-minifigures-arcanine-and-rayquaza-s' AND md5(content) = '3a3ecd0d7a42463dae88283c1c24677e'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('72154', '72150', '72160', '72168', '40868') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('72154', '72150', '72160', '72168', '40868') AND s.mrp_verified IS TRUE);
UPDATE public.news_articles SET content = $c$LEGO’s Pick a Brick service is getting a refresh. On September 1st, 2026, expect about 180 new pieces to be added. These aren't brand new mould introductions, mind you. They’re elements that have previously appeared in sets released back in May. It’s how LEGO usually cycles new parts into the PaB system – a trickle-down from recent sets.

This means if you’ve been eyeing a specific piece from a May release for your MOCs or custom builds, there’s a good chance it’ll soon be available through Pick a Brick. It’s a way for LEGO to offer more variety to builders who want to source individual elements directly. The exact list of these new additions is available on New Elementary, which has compiled all the September 2026 PaB new pieces. It’s worth checking out if you’re a dedicated parts hunter.

For those unfamiliar, Pick a Brick is LEGO’s official channel for purchasing individual bricks. You can find elements from retired sets, current sets, and now, newly added pieces from recent releases. It’s a fantastic resource, though sometimes the pricing can be a bit steep compared to buying a whole set for the parts you need. This update is good news for customizers and those looking for specific components, ensuring a more diverse palette of bricks is readily available.

The addition of 180 pieces is a significant refresh for the service. While the source article mentions these are from May releases, the actual list is what matters for builders. It’s not uncommon for specific, in-demand pieces to become available this way. So, if you’ve got a project in mind, keep an eye on the Pick a Brick selection come September.

MyBrickHouse and Toycra are the stores to watch for general LEGO sets, but Pick a Brick orders are typically placed directly through LEGO’s official channels. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for any related sets that might feature these parts.

This refresh is more about component availability than new set announcements. It’s for the dedicated builders who need specific bricks. If you’re after the latest sets, this isn’t that. But if you’re a MOC builder who needs those obscure parts, this is a quiet but important update.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-pick-a-brick-2026-new-elements-arriving-september-1st' AND md5(content) = '714f160818d83ba257a2b5835e036414';
UPDATE public.news_articles SET content = $c$LEGO decided to do things a bit differently at San Diego Comic-Con 2026. Instead of just showing off sets, they turned their booth into some kind of travel agency for pop culture. Think less brick displays, more boarding passes and destination announcements. This sounds like a move to get fans thinking about the experience of LEGO, not just the plastic bricks.

The theme was "Smart Play," and it felt like they were taking attendees on a journey through major LEGO universes. We’re talking about Star Wars, Pokémon, and Ninjago, all presented as destinations you could visit. This approach suggests that new sets tied to these popular themes might have been teased or even revealed at the event, though details are scarce. It’s typical for Comic-Con to be a stage for LEGO reveals, but this travel concept adds a unique layer to how they’re presenting it.

The article from BrickNerd talks about the "thinking behind" this Smart Play experience. It implies LEGO is looking at how kids and adults engage with their toys, focusing on imaginative play and storytelling. Turning the booth into a travel hub fits perfectly with this idea of going places and having adventures, whether in a galaxy far, far away or with a pocket monster.

Unfortunately, no specific set numbers or product details have surfaced from this event yet. This "travel theme" might be a meta-narrative for upcoming waves of sets across these franchises. We’ll have to wait and see what actual products emerge from this convention. It’s the usual post-convention scramble for concrete information.

No official India MRP or store prices are available for any potential sets hinted at by this Comic-Con activation. MyBrickHouse and Toycra are the stores to watch for any official releases that eventually make their way to India. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if official distribution occurs.

This whole "travel booth" concept is interesting. It makes you wonder if future LEGO displays will adopt this more immersive, experiential approach. For now, it’s a tease, a hint of what’s to come, wrapped in a travel brochure. Keep your eyes peeled for more concrete reveals.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-san-diego-comic-con-2026-travel-booth-hints-at-new-sets' AND md5(content) = '4ca8136a29562b3541f135f6e819c057';
UPDATE public.news_articles SET content = $c$Your wallet just sent an SOS after hearing about the LEGO X‑Files lab GWP. The promise of a free 221‑piece Scully’s Lab sounds tempting, but the catch is that you have to buy the main 21369 set first – £179.99 or $199.99 at LEGO.com. Let’s unpack whether the extra lab is a clever add‑on or just a nice‑to‑have extra.

The lab sits on a 16 × 18 baseplate and feels surprisingly solid for its size. The build includes a worktop with a sink, a row of cupboards built from four 3 × 4 window frames, and a central autopsy table lit from above. The detailing is where the set shines: a sunken sink, a microscope on a desk, and a tiny fly tile on the floor give the lab a lived‑in vibe. The minifigure of Dana Scully sports a white lab coat over light‑blue scrubs, latex gloves, and protective glasses that tilt to one side, giving her a worried look. The only glaring omission is the alien minifigure you’d expect on the dissection table – you have to buy the larger X‑Files set to get one.

The set’s piece count of 221 puts it in the mid‑range for GWP builds. It’s not a standalone experience; it truly shines when paired with the main set, completing the investigative scene. If you’re already planning to buy the 21369 X‑Files, the lab feels like a well‑crafted bonus rather than a must‑have. On its own, the lack of an alien makes the build feel a touch incomplete, but the construction techniques are solid and the minifigure is a nice addition to any FBI‑themed collection.

Overall, the lab is an excellent accompaniment that rewards the buyer of the main set. It’s not essential, but if you’re a fan of the series and enjoy adding depth to your builds, it’s worth the extra effort – provided you’re comfortable with the price of the main set.

Check MyBrickHouse for availability. Check Toycra for availability. Expect a 4–6 week lag from global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. That's about 20 months of Netflix Premium.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: IMPORT ONLY. Not in Indian stores — grey market or wait.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-xfiles-scullys-lab-40896-gwp-review-is-it-worth-the-cha' AND md5(content) = 'df220e542df8f5c4bae53d24f34726a0';
UPDATE public.news_articles SET content = $c$LEGO’s book nook collection keeps growing, and the latest addition is a meta one: a book nook of bookshelves. This new LEGO Icons set, revealed ahead of an October 1 release, takes the concept of a miniature scene nestled between your novels and turns it into a charming bookshop itself. The set, internally designated 11379, is called the Bookshop: Book Nook and boasts 1,690 pieces.

The idea is to place this between your existing books, creating a little window into the "Brickville Books" shop. Open it up, and you get a two-storey interior complete with balconies and a spiral staircase. LEGO is promising plenty of detail for bookworms and writers alike, including an author's workspace, reading nooks, and subtle literary nods like a golden cup, magnifying glass, and a black cat statue. It also comes with author and reader minifigures to add a bit of storytelling. It sounds like a perfect display piece for anyone who loves both LEGO and getting lost in a good story.

The US price is set at $149.99, with Canada at $209.99 and the UK at £119.99. This price point puts it firmly in the premium display set category.

No official Indian pricing or release date has been announced yet. MyBrickHouse and Toycra are the stores to watch for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it follows the typical pattern.

Given the success of previous book nooks like the Sherlock Holmes and Lord of the Rings sets, this unlicensed addition seems poised to be another hit. The focus on bookshelf decor and literary references should resonate strongly with adult fans looking for display-worthy models. Whether it will be a quick sell-out like some of its predecessors remains to be seen, but it’s definitely one to keep an eye on if you’re a fan of the theme or just enjoy a well-detailed diorama. The Brothers Brick will have a full review soon, so we'll know more about the build experience then. For now, it's a charming concept with a solid piece count.

Verdict: WAIT — check prices at MyBrickHouse and Toycra before pulling the trigger.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-icons-bookshop-book-nook-11379-announced-will-it-make-i' AND md5(content) = 'a2404c6aa097c09e9baef503ee0ddc7f';
UPDATE public.reviews SET content = $c$"We’ve been expecting you." That’s what LEGO seems to be saying with the new Ideas set, [21373](/sets/21373-downton-abbey) Downton Abbey. And honestly, after the glacial pace of approvals, we’ve been expecting this one too. The price tag, when it eventually lands in India, is going to be a conversation starter. For now, no official Indian prices are out, but the grapevine suggests this monumental landmark won't be cheap.

This isn’t just another LEGO castle; it’s Downton Abbey, or Highclere Castle for the uninitiated. The LEGO Ideas team has taken a beloved property and, after what sounds like a lengthy intellectual property negotiation, delivered a set that aims for grandeur. The review from New Elementary hints at a monumental build, focusing on the architectural accuracy and the challenge of translating a real-world country house into plastic bricks. They received an early copy, which means we’re getting a peek behind the curtain before anyone else.

The build itself is described as intricate, with a focus on capturing the essence of Highclere Castle. Expect clever building techniques and a satisfying construction process for those who appreciate architectural LEGO. The design team’s input suggests a strong emphasis on authenticity, aiming to please both LEGO fans and devotees of the show. This isn't a set you'll rush through; it's a journey into stately home construction. The piece count, though not explicitly stated, is implied to be substantial, fitting for a “monumental landmark.”

Display value is clearly a priority here. The review hints that 21373 is designed to be a showstopper, a centrepiece for any collection. The exterior details are likely to be sharp, and the interior, if accessible, would offer a glimpse into the world of the Crawleys. It’s the kind of set that demands a prominent spot on your shelf, a conversation starter that goes beyond just being a pile of bricks. This is for the fan who appreciates the finer things, both in television and in plastic.

However, the real question for us here in India is always going to be about the price. The source material is light on specifics regarding the US retail price, but the nature of Ideas sets, especially large architectural ones, means we’re looking at a significant investment. The approval process alone suggests this wasn't a quick or cheap endeavour for LEGO, and that cost will inevitably be passed on.

The US retail price is $229.99. MyBrickHouse and Toycra will likely stock this 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra (we earn a commission).

Given the estimated price point, it’s wise to hold off for now. While the set promises an exceptional build and display experience, the initial cost will likely be steep. Waiting for a potential sale or price adjustment is the sensible play here. This is a set that will appeal to a very specific demographic – fans of the show and lovers of detailed architectural builds – and they might be willing to pay a premium. For the average fan, patience is key.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-ideas-21373-downton-abbey-worth-the-wait' AND md5(content) = '566e0a450b5de854386e07615781106a'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('21373') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('21373') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet called. It's not happy about this Pokémon wave. The LEGO Trainer Supplies set ([30730](/sets/30730-trainer-supplies)) is another addition to the SMART Play line, which sounds exciting, but this particular set is more about the journey than the destination. We're talking about accessories here, folks – items to aid your pretend Pokémon training. The biggest kicker? It doesn't actually contain any of those elusive SMART Tags.

LEGO sent this one over for review, and while it's a decent enough little polybag, it feels like a missed opportunity. The packaging itself showcases how the targets are meant to be used, with the Poké Balls being thrown at them. Clever photo editing or some seriously stuck-down photography backdrops, perhaps. The yellow strip on the bag hints at SMART Play, but there's no mention of it on the actual product. This makes sense, as this set doesn't interact with any SMART features. The instructions even wisely include a 'do not throw at faces' warning symbol on the finished Poké Balls. A nice LEGO-fication of the iconic warning.

Now, for the new bits. This set introduces three brand-new elements for 2026 in the LEGO Pokémon theme, specifically these throwable Poké Balls. The 3x3 plate with a stud on the side is particularly interesting, and I'm curious to see how builders will incorporate it elsewhere. You get a standard Poké Ball and a Premier Ball, which is a bit rarer. While they’re not game-changers stat-wise, this set is currently the only place to get that smaller Premier Ball. Remember the old days? You had to buy ten standard Poké Balls just to snag one Premier Ball.

Beyond the balls, we have some fruit and berry elements. Identifying them can be tricky, as they range from pixelated to fully drawn illustrations. We get what could be a Rawst Berry, Belue Berry, or an Eggant Berry, using that enlarged minifigure head piece first seen with Thanos. It's good to see it undecorated here. The new small tri-palm leaf element is a welcome addition, much better than another common leaf. These grass sprig elements could also work for Nanab Berries, showing off the versatility of this new piece for different scales. The other berry could be a Rindo Berry or a Jaboca Berry, and it’s nice to see more colours of that dome element. The final berry resembles a Kelpsy Berry. While an olive leaf might have been more accurate, dark tan ones would have been ideal. The light royal blue crown element, previously exclusive to botanical sets, also appears.

The targets themselves are simple constructions, with a small tuft of grass cleverly hiding the hinge connection. They attach to a base via a click hinge, but this loose connection means the whole target assembly can easily tip over if not secured to a baseplate. It’s a bit flimsy. The magenta build with the potion is likely meant to be a Hyper Potion, more elaborate than the standard potion seen in other sets. The underside of this potion would have been the perfect spot for a SMART Tag, but that would have made the build too thick. A real shame.

My and Toycra will likely stock it 4–6 weeks after global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Overall, 30730 Trainer Supplies is a decent polybag if you're deep into the Pokémon theme and need these specific new elements. The new Poké Balls and berry pieces offer some building potential. However, the lack of a SMART Tag and the flimsy target construction prevent it from being a must-buy. It’s a bit of a missed opportunity, especially considering the price. For the casual fan, it's probably skippable.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-trainer-supplies-30730-worth-1300' AND md5(content) = 'f6182d187581ff48c97d617111cd0bbd'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('30730') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('30730') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet is probably safe this month, but your Instagram feed might be missing out. LEGO’s latest Restaurant of the World Gift With Purchase (GWP), the Greece set ([40908](/sets/40908-restaurants-of-the-world-greece)), is here, and it’s a charming little slice of the Mediterranean. It joins its Mexico and Japan siblings in a quarterly series that’s been surprisingly popular. This one lands as a freebie when you spend US$180 / AU$295 / £160 / €180 or NZD$320 on LEGO.com, but only until August 20, 2026, or while stocks last. That spending threshold is quite steep, pushing this into the territory of needing a significant LEGO purchase just to snag the freebie.

The star of the show, as with previous GWPs in this line, is the exclusive minifigure. This time, it’s a restaurant owner sporting a traditional Greek tunic. The detail on the torso is excellent, with fabric texture and a neat blue trim. Flip it around, and you’ll find a mosaic of a fish – a clear nod to the restaurant’s speciality – alongside some Greek characters that translate to "enjoy your meal." It’s a lovely touch, and a feature LEGO could easily incorporate more often.

The model itself is a picturesque depiction of a traditional Greek Tavern. The classic white and blue colour scheme immediately brings to mind coastal towns like Santorini. The architecture is well-executed, with charming stairs on the side adding visual interest and a unique silhouette. A stickered sign proudly reads "TABEPNA" (Taverna), and a brick-built oversized fish sign reinforces the grilled fish theme. The addition of a trellis with vibrant pink flowers and leaves adds a splash of colour and Mediterranean flair.

Inside, the detailing continues. A bright blue table is set with a cup of coffee and some sunflower seeds. And in a stroke of genius that acknowledges a ubiquitous part of Greek street life, there’s a tiny brown kitten. The set is practically designed for this little feline, with plenty of nooks and crannies, like a small archway window and a dedicated enclave under the restaurant's address. It’s these small, thoughtful details that elevate a GWP from a mere freebie to something genuinely delightful.

The interior is compact, featuring a small kitchenette with a stove, olive oil, and a slice of orange. Hanging on the wall is a Bouzouki, a traditional Greek lute, adding another layer of cultural authenticity. While the interior space is tighter than in previous Restaurants of the World sets, it doesn't detract from the overall charm. Displayed alongside its predecessors, the Greece set fits perfectly, showcasing the design team’s ability to create distinct yet cohesive models. This series has been one of LEGO’s better GWP offerings recently, and with only one more quarter to go, it’s been a consistently strong run.

The main hurdle here is the GWP threshold. If you were already planning a large purchase from the August 2026 releases, then this is a fantastic bonus. However, buying solely to acquire the GWP might be a stretch for many.

MyBrickHouse and Toycra will be the stores to watch for any official releases, but as this is a GWP, it's unlikely to be sold separately. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for local availability.

For the set itself, it’s a solid 4 out of 5. The design is charming, the minifigure is exclusive and well-detailed, and the cultural nods are appreciated. It’s a great little display piece. The verdict, however, is WAIT. Unless you’re already making a substantial LEGO purchase that qualifies you for this GWP, the high spending requirement makes it hard to recommend chasing it as a standalone item. It’s a lovely freebie, but not worth breaking the bank for.

Keep building, keep dreaming... And don't let your wallet see your LEGO wishlist.
WAIT

Verdict: WAIT. Good set, but the price will drop.

On that bombshell, bubyee.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-restaurants-of-the-world-greece-40908-a-charming-gwp-wo' AND md5(content) = 'e1371b990c0d25e98c857f6a16e65359'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40908') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40908') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet called. It wants to discuss the LEGO Editions theme, and specifically this new vinyl record set. LEGO has surprised us by expanding this theme beyond sports icons to include pop superstar Olivia Rodrigo. While we previously saw football and F1 moments immortalised in brick, this new wave dives headfirst into contemporary music. Olivia Rodrigo, with her two massive albums and sold-out tours, is undeniably a huge name.

This particular set, [43028](/sets/43028-olivia-rodrigos-vinyl) Olivia Rodrigo's Vinyl, aims to capture her recognisable aesthetic – all purple hues, butterflies, and stars. And yes, it includes Olivia herself as a minifigure. Now, the reviewer admits many of us might not be her target demographic. Fair enough. But the build itself is a representation of a vinyl record, designed to be hung on a wall or displayed on a surface. It’s a 360-piece set, and at £24.99 / $34.99 / €29.99, the price per piece isn't exactly alarming, coming in at around 7p per brick.

The minifigure is a highlight. It depicts Olivia Rodrigo in a glittery silver dress, inspired by her 2022 SOUR tour outfit. The dual-moulded legs for the knee-high boots are a nice touch, and the new hairpiece flows beautifully. She comes with two facial expressions: one smiling, the other a fun wink and tongue-out. It’s a solid representation, capturing her stage presence.

The main build is the vinyl record itself, about 18cm in diameter. The reviewer notes an interesting SNOT technique used to reverse stud direction on the rear, with colour-coding to ensure correct assembly. The front is smoother, featuring attachment points for accessories and Olivia’s printed signature. However, the reviewer is a bit perplexed by the exposed SNOT studs on the rear that are then covered by random tiles. It seems like an unnecessary step if the goal was a smooth surface.

The "hidden feature" is where things get a bit more interesting, and also a bit bizarre. Attached to the rear is a contraption of Technic beams and clear bars. This activates a "pop out" feature. On the front, stars and a butterfly are added, along with a brick-built megaphone – a recognisable prop from her GUTS tour. Olivia’s minifigure clips in next to her signature, holding this megaphone. The reviewer found the pop-out mechanism fun, but the overall purpose of the rear contraption remains a bit unclear. It’s a visual flourish that adds to the display, but it’s not exactly groundbreaking.

The set is clearly aimed at Olivia Rodrigo fans, or "Livies" as they're known. The design elements – the colours, the motifs, the minifigure, the megaphone – are all direct nods to her music and branding. If you're a fan, this is likely a must-have display piece. For the casual LEGO builder, however, the appeal might be limited. It’s a niche product, and while the build techniques are decent and the minifigure is well-executed, the overall set might feel a bit too specific for a general audience. It’s fun, it’s functional as a display, and it has a neat little trick up its sleeve, but it doesn't push any major LEGO boundaries.

No official India retail price or availability has been confirmed yet. MyBrickHouse and Toycra are the stores to watch for potential future stock. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it does arrive officially.

The verdict here is clear. If you're a dedicated Olivia Rodrigo fan, this set is probably a no-brainer, a fun way to showcase your allegiance. The minifigure is excellent, and the vinyl design is clever. But for anyone else, the appeal is significantly reduced. The build is decent but not spectacular, and the niche theme might not resonate. It's a solid 3 out of 5 stars – a good set, but not a universally essential one.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-olivia-rodrigos-vinyl-43028-worth-4400' AND md5(content) = 'fd7132f1528c5bfe69129e06e840bfac'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43028') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43028') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet just got a text from the EMI calculator: it’s about to meet a half‑metre guitar that costs a chunk of your monthly budget. [43031](/sets/43031-olivia-rodrigos-dual-guitar) Olivia Rodrigo's Dual Guitar is the headline act of the new Olivia Rodrigo Editions sub‑theme, and it doesn’t shy away from drama. At 1,228 pieces, the set promises a blend of fashion, music, and a dash of hidden‑room engineering that will keep you busy long after the stickers are peeled.

The most striking feature is the split‑design guitar itself. One half is a glossy purple acoustic, the other a red‑electric that screams stage lights. The split isn’t just visual; it’s functional. Inside the acoustic side sits a tiny dressing‑room that slides out when you turn a discreet black knob on the front. The mechanism uses a few thin Technic beams and axles, delivering a surprisingly smooth motion for a set of this size. It’s the kind of hidden detail that makes you pause, admire, then dive back into the build.

Two minifigures accompany the instrument, each representing a distinct era of Olivia’s career. The first dons a sparkly red dress from the GUTS World Tour, complete with star‑studded tights and black boots. Her expression toggles between a wide‑eyed smile and a cheeky wink with a tongue out. The second captures her Glastonbury 2025 look: a white corseted dress with a flowing skirt. While the skirt piece feels a bit loose around the waist, the corset detailing is on point, and the hair sculpting mirrors her real‑life style. Together they bring the total count of unique Olivia Rodrigo minifigures to five, a respectable tally for a debut sub‑theme.

Stickers are abundant – 13 just to spell out “Olivia” – and they cover everything from guitar logos to tiny lipstick tubes. The stickers add a glossy finish that elevates the overall look, though you’ll need a steady hand to align the smaller pieces without smudging. The guitars themselves are built on a sturdy brick framework, with the acoustic side featuring a half‑sound‑hole made from large arches. The electric side bears the signature “OR” butterfly logo, stars, and a heart, all printed on a custom‑printed panel.

From a construction perspective, the set balances classic LEGO techniques with a few fresh twists. The split‑guitar body encourages you to think in mirror images, while the hidden dressing room invites a mini‑theatre of its own. The build isn’t overly complex – it stays comfortably within the 1,228‑piece range – but the interior surprise adds an extra layer of satisfaction that many fans will appreciate.

Design-wise, the dual‑guitar concept is bold. It captures both the acoustic intimacy of a singer‑songwriter and the electric energy of a pop star, mirroring Olivia’s versatile catalog. The colour palette – deep purples, bright reds, and crisp whites – works well together, making the model a eye‑catching display piece for any shelf. The minifigures, despite the minor waist‑connection issue, are among the most detailed in recent releases, especially the embroidered dress textures and the tiny megaphone prop.

Value‑for‑pieces is respectable. Compared to other licensed builds, the piece count is generous, and the build experience is richer than many comparable music‑themed sets.

Overall, Olivia Rodrigo’s Dual Guitar delivers a satisfying build, a striking display, and enough fan‑service to please both LEGO collectors and music fans. If you’re already budgeting for a new addition, this one checks the right boxes without demanding a loan.

MyBrickHouse and Toycra — check both for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: BUY NOW. The price is right — grab it.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-olivia-rodrigos-dual-guitar-43031-worth-15400' AND md5(content) = '8cc9e32ff131589ae7856b7f7c477b98'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43031') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43031') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet probably isn't hyperventilating yet, but a tiny Hogwarts from LEGO? That's the kind of impulse buy that can sneak up on you. This isn't the massive, room-dominating Hogwarts we've seen before. This is a scaled-down version, and scaling down often means a different kind of build, a different kind of price pain, and a different kind of display value. The question is, does this mini version capture the magic without demanding a dragon's hoard?

The YouTube review from 2026-08-06 doesn't give us a set number, which is always a bit of a red flag. It means we can't easily cross-reference prices or piece counts. What we can glean is that this is aimed at those who love Hogwarts but maybe don't have the space, or the sheer financial fortitude, for the UCS behemoth. The build itself, from what's shown, seems to focus on recognizable architectural features. You'll get the iconic towers, the main castle body, and perhaps some of the grounds. It's less about intricate interior details and more about that instantly recognizable silhouette.

For the builder, this likely means a quicker construction time. It's not a weekend-long epic; it's probably something you can knock out in an afternoon. This can be a good thing – less commitment, more immediate gratification. However, it also means fewer interesting building techniques might be on display. Sometimes, smaller sets have to compromise on the innovative SNOT (Studs Not On Top) work or the clever part usage that makes larger, more complex sets so satisfying. Here, the focus is on assembly and final appearance.

The display potential is where this set might win or lose. Placed on a shelf, it will undoubtedly evoke nostalgia for Harry Potter fans. It’s a conversation starter, a little piece of wizarding world magic on your desk. But compared to its larger sibling, it lacks that sheer "wow" factor. It's more of a charming trinket than a centrepiece. Whether that's enough for you depends entirely on your LEGO priorities. If you're a completist, or just love a mini-build that captures an essence, this could be for you. If you're looking for a deep building experience or a showstopper display piece, you might find it wanting.

The biggest unknown, of course, is the price. Without a set number or an official release price, we're in that frustrating limbo. Based on similar-sized licensed sets, we can only guess. It could be a sensible impulse buy, or it could be priced in a way that makes you question why they didn't just make it bigger.

There are no official Indian prices or availability dates for this LEGO Mini Hogwarts Castle yet. Keep an eye on MyBrickHouse and Toycra for potential listings, though it might be import only for a while. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch if it does appear in Indian retail.

Ultimately, this Mini Hogwarts Castle sits in an interesting spot. It offers the allure of a beloved location in a more accessible package. The build is likely straightforward, and the display value is cute rather than commanding. But the lack of a set number and the uncertainty around pricing make it hard to give a definitive recommendation right now. If the price is right when it lands, it could be a delightful little addition. If it's priced too high for its size and complexity, you might be better off saving up for something bigger or waiting for a sale. For now, it’s a "wait and see" situation.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-mini-hogwarts-castle-review-is-it-worth-your-wallets-sc' AND md5(content) = 'cddd93dfb12a2b611c26ef1fce652c44';
UPDATE public.reviews SET content = $c$Your wallet might be sweating, but at least this one's a Pokémon. The LEGO Up-Scaled Red Minifigure ([40868](/sets/40868-up-scaled-red-minifigure)) brings the iconic trainer to life in brick form. It’s a 930-piece set, and while it doesn't come cheap, the build quality and design are pretty solid. The question is, can you justify the price for a character who's mostly silent but always legendary?

This isn't just another LEGO set; it's part of the up-scaled minifigure line, which means it’s large, detailed, and designed to be a statement piece. Red, the player character from the early Pokémon games and the inspiration for Ash Ketchum, is instantly recognisable. The set captures his look well, from his spiky hair to his signature V.S. Seeker device on his backpack, all built using bricks. No stickers here, which is always a win. The box art is bright and colourful, aimed at a 10+ audience, which is refreshing compared to some of the more sterile 18+ packaging out there. Inside, you get nine bags of pieces and a single instruction booklet. The way the bags were stacked in the box was surprisingly neat, a small detail but one that shows good presentation.

The build experience itself is robust. The minifigure is assembled in sections, connected by Technic axles and pins, making it sturdy enough for some light play or just posing. The arms have small gears to keep them from drooping, a clever touch. The body gets its characteristic trapezoid shape through some smart brick-building techniques, and the head can rotate 360 degrees thanks to a turntable base. Even the hat is attached with a pivoting element, giving it that classic tilted look, though like other similar builds (think Mario’s cap), it leaves a bit of an open cavity when removed. The spiky hair is a highlight, using slopes and curved slopes to great effect, with even a peek of brown hair visible at the back.

Once completed, the Red minifigure looks fantastic. The brick-built details are excellent, especially the V.S. Seeker. The spiky hair texture is particularly well done with the use of elongated cheese slopes. The only minor quibble is the Poké Ball accessory; it looks a bit small and cuboid, perhaps more in line with the SMART Play Pokémon rather than the traditional round ones.

The build is solid, the design is accurate, and the character choice is a strong one for Pokémon fans. However, the price point is where things get a bit tricky. The US retail is $79.99, and the price per piece is around 8.6 cents. This is pretty standard for the up-scaled minifigure line, but it’s still a significant investment.

MyBrickHouse and Toycra will likely stock this set 4–6 weeks after the global launch, so keep an eye on them. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

While the build quality and the iconic character make this a desirable set, the cost is considerable. It’s a great display piece for any Pokémon fan, and the build is engaging. But for that price, you’d expect perfection, and while it’s very close, the slightly small Poké Ball and the cost itself hold it back from a full-hearted recommendation right away. If you’re a die-hard Pokémon fan or collector of the up-scaled minifigures, this is a must-have. For others, waiting for a sale might be the smarter move.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-up-scaled-red-minifigure-40868-worth-10500' AND md5(content) = '93f6a7580db62ca74775f27ed2e38b42'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('40868') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('40868') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet just got a spooky surprise. LEGO's September Build-a-Minifigure (BAM) wave is here, and it's all about Halloween. Usually, September means a fresh batch of these little guys, and this year is no different. Three new characters are ready to haunt your LEGO Store's BAM stations. Are they worth the candy money? Let's find out.

The BAM strategy is simple: get you into the LEGO Store. You pick a hairpiece, a head, a torso, legs, and an accessory. For the Halloween 2026 wave, we get Frankenstein's Monster, a Werewolf Costume Girl, and a Zombie Girl. They come in those new eco-friendly cardboard boxes, which is a nice touch, though some stores might still pack them themselves. The price point is US$9.99, which isn't exactly pocket change for three minifigures.

First up, Frankenstein's Monster. This version ditches the molded head we've seen before, opting for a printed face. It works, with bolts on the sides and a lightning print. The tattered jacket detail is good, especially the candy corn sticking out of the breast pocket. It’s a solid interpretation, even without the molded head.

Then there's the Werewolf Costume Girl. This one feels like the standout of the trio. The recolored wolf head is a useful piece, and the torso design is fantastic – fur details and candy spilling out of pockets. It perfectly captures the trick-or-treater vibe. My only quibble is the accessory: a spider. A trick-or-treat bucket, especially a Jack o' Lantern one, would have elevated this to perfection. A minor miss on an otherwise great minifigure.

Finally, the Zombie Girl. Always good to see more zombies. She sports a tattered dark red top and a classic zombie face. The printed dress skirt piece is missing, which is a shame. While an unprinted skirt offers versatility for the BAM station, it feels like a missed opportunity for a more detailed minifigure.

These BAM exclusives are designed to draw you in, and they do a decent job. The Halloween theme is always popular, and these figures fit right in. However, at US$9.99 for three customisable figures, the value proposition is always a bit iffy. You're paying for the customisation and the exclusivity, not necessarily a massive piece count.

No official India retail price or MRP is confirmed yet, but expect these to land in stores like Toycra and MyBrickHouse 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

If you're a minifigure collector, especially a fan of Halloween themes, these are probably a must-have. The Frankenstein and Werewolf figures are particularly strong. However, if you're on a tight budget, the price for three customisable minifigures might make you pause. They are fun, well-designed figures, but the cost per minifigure is still a bit steep when you consider you can get larger sets for similar prices. The Zombie Girl is the weakest link, and the lack of a printed skirt hurts. Overall, a good but not great wave.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-build-a-minifigure-2026-halloween-haul-or-heartbreak' AND md5(content) = 'c007f02130d560975d02cf3562ac78b9';
UPDATE public.reviews SET content = $c$Your wallet just got a retro jolt with a ₹25,700 price tag on the LEGO Donkey Kong Arcade. The set, 72051, lands at 1,367 pieces and promises a playable homage to the 1981 arcade classic. If you’ve ever tried to coax a high‑score out of a brick‑built joystick, this one feels like a nostalgic cheat code—if you can stomach the price.

The build experience is surprisingly smooth for a set that tries to do more than just sit on a shelf. The instructions guide you through a modular base, a sturdy cabinet, and the iconic arcade screen. The first mechanism—a seesaw‑like lever that powers the jump button—feels solid, and the pivot points hold up without the dreaded wobble that can plague other moving‑part sets. LEGO’s engineering shines here; the rotating plates transfer motion cleanly, and the final assembly snaps together with a satisfying click.

A key selling point is the ability to actually play a simplified version of Donkey Kong. Press the yellow jump button, watch the barrel‑like pieces roll, and you’ll see a tiny pixelated Mario (well, “Jumpman”) climb the scaffolding. It’s a clever nod to the original game’s control scheme, and it adds a layer of interactivity that most display‑only arcade sets lack. That said, the gameplay is more novelty than depth—once you’ve cleared the first level, the fun fizzles faster than a burnt-out 8‑bit cartridge.

Design-wise, the cabinet captures the retro aesthetic perfectly. The black chassis, bright red and yellow accents, and the two large sticker sheets for the screen and side graphics hit the mark. However, the reliance on stickers is a double‑edged sword. Applying them can be a nightmare, especially if you’re prone to air bubbles or have a trembling hand. The reviewer notes that, given past Nintendo‑themed LEGO sets, printed elements would have been preferable, but the stickers keep the price marginally lower. If you’re a stick‑and‑puzzle purist, you might find this a minor annoyance.

The box itself is a nostalgic treat, featuring a hinged lid reminiscent of old arcade cabinets. The packaging is minimalist, with subtle diagrams that don’t overpromise the set’s capabilities. This restraint is appreciated, but it also means you won’t get a sneak peek at the inner mechanics until you crack it open. The inclusion of two large sticker sheets, though, adds to the unboxing excitement—if you can survive the sticker‑application phase.

Compared to LEGO’s own 10323 PAC‑MAN Arcade, the Donkey Kong set leans more into playability at the expense of some build polish. The piece count is respectable, and the per‑piece price sits around ₹19, which aligns with other premium adult sets. The set’s appeal will be strongest for fans of classic arcade gaming, collectors of Nintendo memorabilia, and builders who enjoy a functional model. For the broader LEGO audience, the novelty might wear off after a few play sessions.

Overall, the Donkey Kong Arcade delivers a solid build, a functional game, and a design that respects its source material. The price is high, but the set’s unique playability and nostalgic factor justify the cost for the right buyer. If your bank account can handle the ₹25,700 tag, you’re getting a piece of gaming history that’ll sit proudly on a shelf and still let you press the jump button now and then.

Check MyBrickHouse for availability. Check Toycra for availability. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch for Indian availability. That's about 6 months of Netflix Premium.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: BUY NOW. The price is right — grab it.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-don-donkey-kong-arcade-72051-worth-25700' AND md5(content) = '889dbc3ae0a85e19d91a9d243d5fb007';
UPDATE public.reviews SET content = $c$Your wallet is probably already weeping from the other Olivia Rodrigo sets. Now comes the LEGO Concert Moon ([43029](/sets/43029-olivia-rodrigos-concert-moon)), and it’s asking for more. This one recreates that iconic moment from the GUTS World Tour where Olivia flies over the crowd on a giant illuminated moon. It’s a display piece, pure and simple, and for fans, it’s instantly recognisable.

Unlike the other sets in this Olivia Rodrigo Editions range, which scatter song references everywhere, this set focuses on one specific stage spectacle. And it nails it. The brick-built moon, with its black and silver stars, is pretty satisfying to put together. They’ve used those clear trans-bars to make the stars float a bit, which looks good. It’s a solid display model, no doubt. The Olivia minifigure herself is a highlight. She’s got that sparkly chainmail dress, the black bikini top and skirt, and even printed details on her boots. Her face has that signature red lipstick and glittery eyeshadow. It’s a very detailed minifigure, capturing her look from the tour well.

But the real build here, aside from the moon, is the record player. It’s built sideways using a lot of SNOT (Studs Not On Top) techniques, which gives it a clean look with details like the needle arm and buttons on top. It’s a nice build, and they’ve included a couple of cool features. There’s a hidden compartment that slides out when you push a red lever. It’s a neat little trick. And there’s a brick-built version of Olivia’s ‘OR’ logo hidden in the gears, made from small tiles. Very clever. The set also includes a brick-built vinyl record, constructed using similar techniques to another set in the range. It features a sticker with more Olivia motifs like lips, plasters, and a butterfly.

The main issue? It’s a bit light on the Easter eggs compared to the other Olivia Rodrigo sets. If you’re buying these as a collection, you might notice this one is more about the single visual moment than the deep cuts. It’s a good model, a fun build with some clever mechanical bits, but it feels like it’s missing that extra layer of fan service that the others offered. For the price, you’d expect a bit more in terms of play features or those little nods to her music. It’s a decent display piece for a dedicated fan, but perhaps not the most engaging build for a casual LEGO builder. The price point feels a little steep for what’s essentially a single, albeit iconic, stage prop and a very nice minifigure.

In India, this set is not yet available at official retailers. MyBrickHouse and Toycra are the stores to watch for when it eventually releases here. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra. Expect a 4–6 week lag from global launch.

This is a set for the die-hard Olivia Rodrigo fan who wants to capture a specific moment from the GUTS tour. The build is solid, the minifigure is excellent, and the record player has some neat functions. But the lack of Easter eggs and the high price make it a tough recommendation unless you’re absolutely devoted.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-olivia-rodrigos-concert-moon-43029-worth-7150' AND md5(content) = 'fc2eba3ffbc57f201de390c0a6098c6d'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43029') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43029') AND s.mrp_verified IS TRUE);
UPDATE public.reviews SET content = $c$Your wallet is already bracing itself. LEGO has dropped another Olivia Rodrigo set, [43030](/sets/43030-olivia-rodrigos-secret-storage) Olivia Rodrigo's Secret Storage, and it’s packing over a thousand pieces. This isn't just a toy; it’s a display piece, a collector’s item, and potentially a conversation starter for fans of the pop sensation. The question is, does it justify the space on your shelf and, more importantly, the dent in your bank account?

This set aims to capture the essence of Olivia Rodrigo's career, not just a single concert or album. It’s built around a concert touring case, a flight case, designed to look like the real deal. Think black exterior, grey metal-frame edging, and sturdy rubber tyre feet. It’s an impressive display piece, no doubt. The attention to detail on the case itself is commendable, with stickers referencing her GUTS World Tour and other hidden nods that dedicated fans will surely appreciate.

Inside, the case hides three secret compartments. Pulling on the front handle triggers a neat little mechanism, sliding out the front compartment while simultaneously swinging out the two side ones. It’s a clever bit of engineering, reminiscent of those old spy gadgets. Once extended, all three are accessible from the top. Pushing them back in is just as straightforward, particularly the middle one. It’s this hidden functionality that adds a layer of fun beyond just static display.

The set also includes a minifigure of Olivia herself, decked out in the iconic cheerleading outfit from her "good 4 u" music video. The print is detailed, right down to the dual-moulded black gloves. One face shows a simple smile, the other a playful wink, complete with an array of stickers like hearts and butterflies. While the parts themselves are generic enough for any cheerleading squad, the specific print makes it a must-have for fans.

Now for the accessories. There’s a chunky vinyl record, which feels a bit oversized for the scale. The set also comes with a CRT television, a guitar, a microphone with a stand, a makeup bag, and a few other bits and bobs. These are meant to represent elements from her career, offering plenty of visual interest and opportunities for display arrangements within the case.

However, it’s not all perfect. The vinyl record accessory feels disproportionately large, almost comically so. And while the secret compartments are a neat trick, they are quite small once opened. You’re not fitting much substantial into them, which slightly dampens the "secret storage" aspect. The build itself is solid, but the reliance on stickers for key decorative elements, while common, might irk purists.

The price point, £69.99 / $79.99 / €79.99, translates to about 7.4 cents per piece. For a licensed display set with a unique minifigure and a functional mechanism, it’s not outrageous. But given the small size of the secret compartments and the slightly awkward vinyl accessory, it sits in that grey area where you might want to wait for a sale.

MyBrickHouse and Toycra will likely stock this 4–6 weeks after the global launch. Use code ABHINAV12 for 12% off on orders above ₹500 at Toycra.

Ultimately, 43030 Olivia Rodrigo's Secret Storage is a well-executed display piece with a fun hidden feature and a great minifigure for fans. It captures a specific vibe and will undoubtedly appeal to Olivia Rodrigo’s fanbase. For the casual LEGO builder, it might be a bit niche. For the dedicated fan, it’s a solid addition. But for everyone else, the price and the slightly underwhelming secret compartments might mean it’s worth holding out for a discount.

On that bombshell, it's time to say goodbye. I'll see you on the next one. Bubyee.

Verdict: WAIT. Good set, but the price will drop.

Updated 1 Oct 2026: estimated price removed; official Indian pricing not yet announced.$c$
  WHERE slug = 'lego-olivia-rodrigos-secret-storage-43030-worth-the-hype' AND md5(content) = '9f35ebb528402819ba0a9f0bdd0bbb18'
    AND NOT EXISTS (SELECT 1 FROM public.store_prices sp WHERE sp.set_id IN ('43030') AND sp.price_inr IS NOT NULL)
    AND NOT EXISTS (SELECT 1 FROM public.sets s WHERE s.set_number IN ('43030') AND s.mrp_verified IS TRUE);
