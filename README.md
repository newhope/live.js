# live.js

<a href="http://www.livejs.com">live.js</a> fork with <a href="http://leaverou.github.io/prefixfree/">PrefixFree</a> support.

## Usage

Put <strong>live.js</strong> in your <strong>js</strong> directory and add this in `<head>`:

```html
<script>
window.onload = function(){
	var script = document.createElement('script');
	script.src = "js/live.js";
	document.querySelector('head').appendChild(script);
};
</script>
```

## Bookmarklet

Copy and past in new bookmark URL:

```javascript
javascript:(function(script){script.setAttribute('src','https://github.com/newhope/live.js/master/live.js');var head=document.querySelector('head').appendChild(script);})(document.createElement('script'));
```