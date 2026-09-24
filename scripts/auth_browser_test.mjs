import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const HUB='242f57c2-6e37-4977-b3c5-1c87de7d0b98';
const PUFFIN='aec16956-3793-4543-873b-4412646ca1eb';
const sharedEmail=process.env.SHARED_EMAIL;
const sharedPassword=process.env.SHARED_PASSWORD;
const hubEmail=process.env.HUB_EMAIL;
const hubPassword=process.env.HUB_PASSWORD;
for(const [k,v] of Object.entries({sharedEmail,sharedPassword,hubEmail,hubPassword})) assert.ok(v,k+' missing');

const browser=await chromium.launch({headless:true});

async function signIn(page,{file,email,password,gymId}){
  await page.goto(BASE+'/'+file,{waitUntil:'domcontentloaded'});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('hybrid-gym-id')),gymId,file+' did not set route gym');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('#signIn').click();
}

async function loginDesktopAndAssert({file,email,password,gymId,gymName}){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await signIn(page,{file,email,password,gymId});
  await page.waitForURL(u=>u.pathname.endsWith('/admin.html')&&u.searchParams.get('gym_id')===gymId,{timeout:30000});
  await page.locator('#adminFrameGym').filter({hasText:gymName}).waitFor({state:'visible',timeout:30000});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('hybrid-gym-id')),gymId,'desktop admin shell changed gym context');
  assert.deepEqual(errors,[],file+' desktop page errors: '+errors.join(' | '));
  await context.close();
}

async function loginMobileAndAssert(){
  const context=await browser.newContext({viewport:{width:390,height:844}});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(String(e)));
  await signIn(page,{file:'hybrid-hub-login.html',email:sharedEmail,password:sharedPassword,gymId:HUB});
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'),{timeout:30000});
  await page.locator('#sideGym').filter({hasText:'Hybrid Hub'}).waitFor({state:'visible',timeout:30000});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('hybrid-gym-id')),HUB,'mobile handoff changed gym context');
  const menu=page.locator('.admin-mobile-menu-btn');
  await menu.waitFor({state:'visible',timeout:10000});
  await menu.click();
  assert.equal(await page.evaluate(()=>document.body.classList.contains('admin-mobile-open')),true,'mobile admin menu did not open');
  assert.deepEqual(errors,[],'Hybrid Hub mobile page errors: '+errors.join(' | '));
  await context.close();
}

async function rejectCrossGym(){
  const context=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await context.newPage();
  await signIn(page,{file:'puffin-performance-login.html',email:hubEmail,password:hubPassword,gymId:PUFFIN});
  await page.waitForURL(u=>u.pathname.endsWith('/index.html'),{timeout:30000});
  await page.waitForTimeout(1200);
  assert.ok(!page.url().includes('/admin.html'),'Hub-only user was admitted to an admin shell through Puffin route');
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('hybrid-gym-id')),PUFFIN,'denied route silently switched to another gym');
  const text=(await page.locator('body').innerText()).replace(/\s+/g,' ');
  assert.ok(text.includes('Use the login page for the gym you want to open.'),'cross-gym denial message missing');
  await context.close();
}

try{
  await loginDesktopAndAssert({file:'hybrid-hub-login.html',email:sharedEmail,password:sharedPassword,gymId:HUB,gymName:'Hybrid Hub'});
  await loginDesktopAndAssert({file:'puffin-performance-login.html',email:sharedEmail,password:sharedPassword,gymId:PUFFIN,gymName:'Puffin Performance'});
  await loginMobileAndAssert();
  await rejectCrossGym();
  console.log('HybridOne auth browser checks passed');
} finally {
  await browser.close();
}
