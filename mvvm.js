/*
*  自己手动实现一个MVVM框架 20180707
*
* */

// 响应式分为两个流程：
// 1：收集依赖 dep.addSub(Dep.target)       observe -->  new Dep() -->  Object.defineProperty  -->  首次编译 new Watcher() 时触发 getter 这时 watcher 实例(带有update方法)被 dep 实例收集到依赖队列。 
// 2：视图更新 dep.notify()                 触发 setter -->  执行 dep.notify() -->  遍历执行依赖队列里的所有 watcher 实例的 update 方法 -->  执行函数。

function Vue(options = {}) {
	this.$options = options;// 模仿Vue的套路
	var data = this._data = this.$options.data;
	observe(data);// 调用观察函数，递归的添加数据劫持
	for(let key in data) {
		Object.defineProperty(this, key, { // 访问和修改每一个this的key时代理成this._data的值。
			enumerable : true,
			get() {
				return this._data[key];
			},
			set(newVal) {
				this._data[key] = newVal;
			}
		})
	}
	initComputed.call(this);
	new Compile(options.el, this)
}

// 1: 观察函数
function observe (data) {
	if(typeof data !== 'object') return;//
	return new Observe(data);
}
function Observe(data) {  // [əbˈzɜ:rv]观察 研究
	let dep = new Dep();  // data 中的每个对象都会对应一个 dep 对象， data 对象上的每个属性都会被追加 getter setter
	for(let key in data) {  // 循环遍历data
		let value = data[key];
		observe(value);
		Object.defineProperty(data, key, { // Object.defineProperty的方式定义属性
			enumerable: true, // 可枚举
			get() {
				Dep.target && dep.addSub(Dep.target); // [watcher]            1：订阅     所有的读取都不会添加订阅，只有 new Watcher 的时候才添加 就是因为:  Dep.target 开关的存在  
				return value;
			},
			set(newVal) { // 更改值的时候
				if(newVal === value) {return;}
				value = newVal; // 这里只用给value赋值就可以了，下次取值的时候后再get函数中将这个value返回
				observe(newVal); // 如果设置的值是一个对象，同样对这个对象做数据劫持
				dep.notify(); // 让所有的 watcher 的 update 方法执行               2：发布
			}
		})
	}
}

// 2: 编译函数

// 编译函数做两件事：
// 	   1：正则替换完成首次编译
// 	   2：同时 new Watcher()  -->  打开添加依赖开关  -->  读取 data 数据 -->  触发 getter --> 完成依赖搜集

function Compile(el, vm) {
	vm.$el = document.querySelector(el);// 获取容器元素
	let fragment = document.createDocumentFragment();// 文档碎片

	while(children = vm.$el.firstChild){// 1: 把元素全部移入文档碎片
		fragment.appendChild(children);
	}
	replace(fragment);  // 2：用JS变量替换：{{...}}
	function replace (fragment) { // 循环每个节点，如果有大括号就替换成js变量
		Array.from(fragment.childNodes).forEach(function(node) {
			let text = node.textContent;
			let reg = /\{\{.*\}\}/;
			if(node.nodeType === 3 && reg.test(text)) { // 既是文本节点又有大括号
				let arr = reg.exec(text)[0].slice(2,-2).split('.');// ['obj', 'a'] 讲师这里直接用arr = RegExp.$1，我这里不能实现？？？？？？？？
				let value = vm;
				arr.forEach(function(k) {
					value = value[k]; // step1: value = this.obj     step2: value = this.obj.a      这小技巧很66666666666666
				});
				new Watcher(vm, reg.exec(text)[0].slice(2, -2), function(newVal) { // 函数里需要接收一个新值
					node.textContent = text.replace(/\{\{.*\}\}/, newVal); // 替换
				});
				node.textContent = text.replace(/\{\{.*\}\}/, value); // 替换
			}
			if(node.nodeType === 1) { // 元素节点  所谓数据双向绑定的实现   仅仅只需监听输入框的input事件即可
				let nodeAttrs = node.attributes;
				Array.from(nodeAttrs).forEach(function(attr) {
					let name = attr.name;
					let exp = attr.value;
					if(name.indexOf('v-') === 0) { // 姑且认为是 v-model
						node.value = vm[exp]; // 为什么视频中直接这样就可以实现，我这里为什么不行呢,要用上边这么多的代码才能实现？？？？？？？？
						new Watcher(vm, exp, function(newVal) {
							node.value = newVal; // 当watch触发时会自动将内容放到输入框内
						})
						node.addEventListener('input', function(e) {
							let newVal = e.target.value;
							vm[exp] = newVal;
						})
					}
				})
			}
			if(node.childNodes) { // 如果当前节点有子节点 就把当前节点放进去看是否能被替换
				replace(node);
			}
		})
	}
	vm.$el.appendChild(fragment);// 3：替换后再塞入DOM中。
}

// 3: 发布订阅   绑定的方法都有一个update属性     订阅者 Dep ，它的主要作用是用来存放 Watcher 观察者对象
function Dep() {
	this.subs = [];
}
Dep.prototype.addSub = function(sub) { // 1: 订阅
	this.subs.push(sub);
};
Dep.prototype.notify = function() {    // 2: 发布     notify  [ˈnoʊtɪfaɪ] 通知 发布
	this.subs.forEach(sub => sub.update());
};
function Watcher(vm, exp, fn) { // 这个类创建的实例都有update方法
	this.vm = vm;
	this.exp = exp;  // 添加到订阅中
	this.fn = fn;
	Dep.target = this;
	let arr = exp.split('.');
	let val = vm;
	arr.forEach(function(k) { // this.obj.a  这里会触发 vm 的 data 上边的 get 方法   JS 引擎立即马上同步执行 getter 
		val = val[k];
	});
	Dep.target = null;
}
Watcher.prototype.update = function() {
	let arr = this.exp.split('.');
	let val = this.vm;
	arr.forEach(function(k) { // this.obj.a
		val = val[k];
	});
	this.fn(val);
};



function initComputed() {
	let vm = this;
	let computed = this.$options.computed;
	Object.keys(computed).forEach(function(key) {

		Object.defineProperty(vm, key, {
			get: typeof computed[key] === 'function' ? computed[key] : computed[key].get,
			set(){}
		})

	})
}