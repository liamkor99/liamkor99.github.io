const projects=[
['oxygenius','Oxygenius','An educational tool teaching Durham middle and high schoolers the scientific concepts behind pulse oximetry.','01','blue','assets/project-images/oxygenius.png'],
['r2d2','R2D2','An interrupt-driven lightbox integrating Arduino firmware, a custom PCB, and a 3D-printed enclosure.','02','blue','assets/project-images/r2d2.png?v=2'],
['timer-box','Timer Box','A rugged timed paper flyer dispenser for communication with civilian populations.','03','teal','assets/project-images/timer-box.png'],
['dog-toy','Dog Toy','A remote-controlled dog toy designed for larger dogs.','04','teal','assets/project-images/dog-toy.png?v=2'],
['phone-binger','Phone Binger','A simple phone finder box built with an ESP-32 Arduino and a custom Apple Shortcut.','05','navy','assets/project-images/phone-binger.jpg'],
['iron-man-mask','Iron Man Mask','A 3D-printed working Iron Man mask with a button-actuated visor.','06','navy','assets/project-images/iron-man-mask.jpg'],
['pelican-cases','Pelican Cases','Rugged modified Pelican cases for an industrial client’s proprietary device.','07','blue','assets/project-images/pelican-cases.png'],
['junction-boxes','Junction Boxes','Electrical junction boxes for an electrical VTOL designer company.','08','teal','assets/project-images/junction-boxes.png'],
['hand-tremor','Hand Tremor Stabilization Device','A low-cost prototype meant to dampen essential tremors.','09','blue','assets/project-images/hand-tremor.png?v=2']
];
const q=new URLSearchParams(location.search),id=q.get('id');
function visual(p){return p[5]?`<div class="project-image photo"><img src="${p[5]}" alt="${p[1]} project image"></div>`:`<div class="project-image ${p[4]}">${p[3]}</div>`}
if(location.pathname.endsWith('projects.html'))document.querySelector('#all-projects').innerHTML=projects.map(p=>`<a class="project-card" href="project.html?id=${p[0]}">${visual(p)}<h3>${p[1]}</h3><p>${p[2]}</p></a>`).join('');
if(location.pathname.endsWith('project.html')){const p=projects.find(x=>x[0]===id)||projects[0];document.title=p[1]+' — Liam Korol';document.querySelector('#detail-number').textContent='Project '+p[3];document.querySelector('#detail-title').textContent=p[1];document.querySelector('#detail-description').textContent=p[2];document.querySelector('#detail-about').textContent=p[2]+' This project page is ready for process photos, technical details, outcomes, and a reflection on the design decisions behind the work.';document.querySelector('#detail-visual').outerHTML=visual(p).replace('project-image','detail-visual')}
