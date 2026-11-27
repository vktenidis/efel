// Forecast only. All values are euros. This module never reads or writes league balances.
function projectClubEconomy({place, weekly, weeks, upgrades}) {
  const prizes=[42000000,27000000,18000000,10000000,8500000,7000000,6000000,5000000];
  if(!Number.isInteger(place)||!prizes[place-1]||!Number.isInteger(weekly)||weekly<0||weekly>8
    ||!Number.isInteger(weeks)||weeks<1||weeks>20||!Number.isInteger(upgrades)||upgrades<0||upgrades>2)throw RangeError('Invalid season scenario');
  const starterFees=23*500000+2*6000000;
  const starterWages=23*60000+2*450000;
  const income=28000000+prizes[place-1]+weekly*weeks*1000000;
  const target=200000000+6000000;
  let cash=28000000-starterFees,payroll=starterWages;
  const seasons=[];
  for(let season=1;season<=3;season++){
    cash+=income-payroll;
    if(season===1){
      cash-=upgrades*35000000;
      payroll+=upgrades*(2000000-60000);
    }
    seasons.push({season,cash,payroll,affordable:cash>=payroll+target,upgradeFunded:cash>=payroll});
  }
  return {income,starterFees,starterWages,target,seasons};
}
if(typeof module!=='undefined'&&module.exports)module.exports=projectClubEconomy;
