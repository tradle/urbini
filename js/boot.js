window.onload = function () {
  var div = d.createElement('div');
  d.getElementById('page').appendChild(div);
  if (localStorage  &&  localStorage.getItem)
    localStorage.setItem('homePage', Lablz.homePage);
  div.innerHTML = Lablz.homePage;
  
  var s = d.createElement('script'); 
  s.type = 'text/javascript';
  s.charset = 'utf-8';
  s.async = false;
  s.src = Lablz.initScript.src; 
  s.setAttribute('data-main', Lablz.initScript['data-main']); 
  d.getElementsByTagName('head')[0].appendChild(s);
  
}