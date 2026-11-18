// Az admin felület egyetlen szkriptje. Nélküle is minden működik, csak a megerősítő kérdés marad el.

// Lemondás és törlés előtt megerősítést kér.
document.addEventListener('submit', (e) => {
  const kerdes = e.target instanceof HTMLFormElement ? e.target.dataset.megerosites : undefined;
  if (kerdes && !window.confirm(kerdes)) e.preventDefault();
});

// Az új foglalásnál a nap kiválasztása után rögtön megjelennek az órák. Az évszám gépelése közben
// (pl. 0002, 0020) még nem küldi el, csak ha a dátum már nem a mai nap előtti.
for (const mezo of document.querySelectorAll('input[data-automatikus]')) {
  mezo.addEventListener('change', () => {
    if (mezo.value && mezo.value >= mezo.min && mezo.form) mezo.form.requestSubmit();
  });
}

// A visszaigazoló levél csak e-mail címmel választható.
const email = document.querySelector('input[name="email"]');
const visszaigazolas = document.querySelector('input[data-email-fuggo]');
if (email && visszaigazolas) {
  const frissit = () => {
    visszaigazolas.disabled = !email.value.trim();
  };
  email.addEventListener('input', frissit);
  frissit();
}
