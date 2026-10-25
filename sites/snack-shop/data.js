/* =========================================================
   宿舍补给站 · 数据文件
   改价格、改名字、加商品，只要改这个文件，不用动其他文件。
   字段说明：
     id     商品的唯一编号（不要重复）
     cat    分类：snack 零食 / noodle 泡面 / fruit 水果 / drink 饮料
     name   商品名称
     spec   规格，例如 70g/袋
     price  现价（元）
     old    原价（元，可选，填了会显示划线价）
     unit   单位：袋 / 桶 / 份 / 斤 / 盒 / 瓶
     emoji  商品图标（换一个 emoji 就能换图）
     sales  已售数量（数字，用来排序和显示）
     badge  角标（可选）：hot 热销 / new 新品 / spicy 辣
     desc   一句话卖点
   ========================================================= */

window.SHOP = {
  name: '宿舍补给站',
  slogan: '零食 · 泡面 · 水果',
  minOrder: 8,          // 起送价（元）
  deliveryFee: 1.5,     // 配送费（元）
  freeDeliveryAt: 15,   // 满多少元免配送费
  cookFee: 1,           // 泡面「泡好送上门」每份加价
  openHour: 9,          // 每天几点开始接单
  closeHour: 23,        // 每天几点截单
  phone: '138-0000-0000',
  wechat: 'sushe_buji',
  qq: '000000000',
  email: '3154067760@qq.com',   // 新订单 / 付款通知发到这个邮箱
  buildings: ['1栋', '2栋', '3栋', '4栋', '5栋', '6栋', '7栋', '8栋', '9栋', '10栋', '11栋', '12栋', '图书馆', '教学楼A'],
};

window.CATEGORIES = [
  { id: 'all',    name: '全部',   icon: '🛍️' },
  { id: 'snack',  name: '零食',   icon: '🍪' },
  { id: 'noodle', name: '泡面',   icon: '🍜' },
  { id: 'fruit',  name: '水果',   icon: '🍓' },
  { id: 'drink',  name: '饮料',   icon: '🥤' },
];

window.PRODUCTS = [
  /* ---------------- 零食 ---------------- */
  { id: 's01', cat: 'snack', name: '乐事薯片 原味', spec: '70g/袋', price: 5.5, unit: '袋', emoji: '🍟', sales: 386, badge: 'hot', desc: '追剧搭子，咔嚓咔嚓停不下来' },
  { id: 's02', cat: 'snack', name: '奥利奥夹心饼干', spec: '116g/包', price: 6, unit: '包', emoji: '🍪', sales: 254, desc: '扭一扭、泡一泡，配牛奶绝了' },
  { id: 's03', cat: 'snack', name: '卫龙大面筋', spec: '106g/袋', price: 3.5, unit: '袋', emoji: '🌶️', sales: 512, badge: 'hot', desc: '宿舍硬通货，辣得过瘾' },
  { id: 's04', cat: 'snack', name: '每日坚果', spec: '25g/袋', price: 4.5, unit: '袋', emoji: '🥜', sales: 168, badge: 'new', desc: '写作业时来一袋，不太罪恶' },
  { id: 's05', cat: 'snack', name: '德芙牛奶巧克力', spec: '43g/块', price: 7, unit: '块', emoji: '🍫', sales: 142, desc: '熬夜复习，来一块回血' },
  { id: 's06', cat: 'snack', name: '波力海苔', spec: '24g/包', price: 6.5, unit: '包', emoji: '🍘', sales: 96, desc: '咸香酥脆，解馋不长胖' },
  { id: 's07', cat: 'snack', name: '乡巴佬卤蛋', spec: '2只/份', price: 3, unit: '份', emoji: '🥚', sales: 288, desc: '泡面灵魂搭档，加一个更香' },
  { id: 's08', cat: 'snack', name: '洽洽香瓜子', spec: '108g/袋', price: 4, unit: '袋', emoji: '🌻', sales: 201, desc: '宿舍唠嗑标配，越嗑越上头' },
  { id: 's09', cat: 'snack', name: '好丽友蛋黄派', spec: '6枚/盒', price: 5, unit: '盒', emoji: '🧁', sales: 175, desc: '早餐救急，甜而不腻' },
  { id: 's10', cat: 'snack', name: '旺旺雪饼', spec: '84g/袋', price: 4.5, unit: '袋', emoji: '🍥', sales: 189, desc: '小时候的味道，一吃就安心' },
  { id: 's11', cat: 'snack', name: '魔芋爽 香辣味', spec: '20g/袋', price: 2.5, unit: '袋', emoji: '🥗', sales: 421, badge: 'hot', desc: '0 脂解馋，辣味上头' },
  { id: 's12', cat: 'snack', name: '焦糖爆米花', spec: '100g/桶', price: 4, unit: '桶', emoji: '🍿', sales: 88, desc: '电影夜必备，甜脆蓬松' },
  { id: 's13', cat: 'snack', name: '乳酸果冻爽', spec: '360g/个', price: 3, unit: '个', emoji: '🍮', sales: 76, desc: '冰箱冻一下，夏天救命' },

  /* ---------------- 泡面 ---------------- */
  { id: 'n01', cat: 'noodle', name: '康师傅红烧牛肉面', spec: '桶装 105g', price: 5.5, old: 6, unit: '桶', emoji: '🍜', sales: 632, badge: 'hot', desc: '经典中的经典，汤都要喝光' },
  { id: 'n02', cat: 'noodle', name: '统一老坛酸菜牛肉面', spec: '桶装 120g', price: 5, unit: '桶', emoji: '🍲', sales: 405, desc: '酸爽开胃，重口味首选' },
  { id: 'n03', cat: 'noodle', name: '汤达人日式豚骨拉面', spec: '桶装 130g', price: 7.5, unit: '桶', emoji: '🍥', sales: 318, badge: 'hot', desc: '汤底浓白，加班熬夜的安慰' },
  { id: 'n04', cat: 'noodle', name: '白象汤好喝 大骨面', spec: '袋装 108g', price: 4, unit: '袋', emoji: '🍜', sales: 156, desc: '便宜大碗，一袋不够吃两袋' },
  { id: 'n05', cat: 'noodle', name: '三养火鸡面 原味', spec: '140g/袋', price: 8.5, unit: '袋', emoji: '🔥', sales: 267, badge: 'spicy', desc: '辣到怀疑人生，谨慎挑战' },
  { id: 'n06', cat: 'noodle', name: '好欢螺螺蛳粉', spec: '300g/袋', price: 12, unit: '袋', emoji: '🍲', sales: 233, badge: 'hot', desc: '臭得真实，香得上头' },
  { id: 'n07', cat: 'noodle', name: '自热小火锅 麻辣牛肉', spec: '420g/盒', price: 18, unit: '盒', emoji: '🌶️', sales: 74, badge: 'new', desc: '不用热水，10 分钟开吃' },
  { id: 'n08', cat: 'noodle', name: '茄皇番茄鸡蛋面', spec: '袋装 105g', price: 4.5, unit: '袋', emoji: '🍅', sales: 132, desc: '不吃辣的同学，选它准没错' },
  { id: 'n09', cat: 'noodle', name: '合味道海鲜面', spec: '杯装 71g', price: 6.5, unit: '杯', emoji: '🦐', sales: 118, desc: '小小一杯，宵夜刚刚好' },
  { id: 'n10', cat: 'noodle', name: '双汇火腿肠', spec: '2根/份', price: 2, unit: '份', emoji: '🌭', sales: 356, desc: '泡面加一根，幸福感翻倍' },

  /* ---------------- 水果 ---------------- */
  { id: 'f01', cat: 'fruit', name: '香蕉', spec: '约500g', price: 4.5, unit: '斤', emoji: '🍌', sales: 298, badge: 'hot', desc: '宿舍常备，顶饿又通便' },
  { id: 'f02', cat: 'fruit', name: '红富士苹果', spec: '约500g', price: 6, unit: '斤', emoji: '🍎', sales: 176, desc: '脆甜多汁，洗洗直接啃' },
  { id: 'f03', cat: 'fruit', name: '砂糖橘', spec: '约500g', price: 7, unit: '斤', emoji: '🍊', sales: 312, badge: 'hot', desc: '一剥就停不下来，注意上火' },
  { id: 'f04', cat: 'fruit', name: '西瓜 切块装', spec: '约400g', price: 9.9, unit: '份', emoji: '🍉', sales: 226, badge: 'hot', desc: '冰镇切块，附赠勺子' },
  { id: 'f05', cat: 'fruit', name: '阳光玫瑰葡萄', spec: '约500g', price: 15, unit: '斤', emoji: '🍇', sales: 88, badge: 'new', desc: '有玫瑰香，无籽好剥' },
  { id: 'f06', cat: 'fruit', name: '草莓', spec: '250g/盒', price: 12, unit: '盒', emoji: '🍓', sales: 94, desc: '当季现摘，酸甜刚好' },
  { id: 'f07', cat: 'fruit', name: '圣女果', spec: '250g/盒', price: 6, unit: '盒', emoji: '🍅', sales: 143, desc: '洗好即食，低卡小零嘴' },
  { id: 'f08', cat: 'fruit', name: '小台农芒果', spec: '约500g', price: 8.5, unit: '斤', emoji: '🥭', sales: 121, desc: '香气浓，甜度高，核很小' },
  { id: 'f09', cat: 'fruit', name: '蓝莓', spec: '125g/盒', price: 9.9, unit: '盒', emoji: '🫐', sales: 67, badge: 'new', desc: '护眼小零嘴，追剧一把抓' },
  { id: 'f10', cat: 'fruit', name: '哈密瓜 切块装', spec: '约400g', price: 8, unit: '份', emoji: '🍈', sales: 85, desc: '清甜解渴，冷藏后更爽' },
  { id: 'f11', cat: 'fruit', name: '水果拼盘', spec: '约500g', price: 12.9, unit: '份', emoji: '🥗', sales: 158, badge: 'hot', desc: '四种当季水果，宿舍分享装' },

  /* ---------------- 饮料 ---------------- */
  { id: 'd01', cat: 'drink', name: '可口可乐', spec: '500ml/瓶', price: 3.5, unit: '瓶', emoji: '🥤', sales: 487, badge: 'hot', desc: '冰的！一定要冰的' },
  { id: 'd02', cat: 'drink', name: '康师傅冰红茶', spec: '500ml/瓶', price: 3, unit: '瓶', emoji: '🧃', sales: 342, desc: '柠檬味，解腻神器' },
  { id: 'd03', cat: 'drink', name: '农夫山泉', spec: '550ml/瓶', price: 2, unit: '瓶', emoji: '💧', sales: 512, badge: 'hot', desc: '多囤几瓶，宿舍必备' },
  { id: 'd04', cat: 'drink', name: '蒙牛纯牛奶', spec: '250ml/盒', price: 3.5, unit: '盒', emoji: '🥛', sales: 208, desc: '睡前一杯，配饼干刚好' },
  { id: 'd05', cat: 'drink', name: '雀巢速溶咖啡', spec: '1条/份', price: 2.5, unit: '条', emoji: '☕', sales: 164, desc: '通宵赶 due 的续命水' },
  { id: 'd06', cat: 'drink', name: '东鹏特饮', spec: '500ml/瓶', price: 5, unit: '瓶', emoji: '⚡', sales: 143, desc: '考前冲刺，一瓶顶一会儿' },
  { id: 'd07', cat: 'drink', name: '元气森林气泡水', spec: '480ml/瓶', price: 5.5, unit: '瓶', emoji: '🫧', sales: 198, badge: 'new', desc: '0 糖 0 卡，喝个气泡上瘾' },
  { id: 'd08', cat: 'drink', name: '王老吉凉茶', spec: '310ml/罐', price: 4, unit: '罐', emoji: '🍵', sales: 112, desc: '吃辣后来一罐，降火' },
];
