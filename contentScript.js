(() => {
  let lastLocation

  setInterval(() => {
    const mainFrame = window.frames['main']
    if (mainFrame && mainFrame.location !== lastLocation) {
      mainFrame.addEventListener('load', () => {
        const params = parseSearch(mainFrame.location.search)
        const body = mainFrame.document.body
        if (params.atknodetype === 'timereg.hours' && body.querySelector('form[name=weekview]')) {
          checkPage(body)
        }
      })

      lastLocation = mainFrame.location
    }
  }, 100)
})()

const parseSearch = (search) => {
  return search
    .slice(1)
    .split('&')
    .map(param =>
      param
        .split('=')
    )
    .reduce((acc, [key, value]) => ({
      ...acc,
      [key]: value
    }), {})
}

const checkPage = async (body) => {
  const table = body.querySelector('table.recordlist')
  const resultDiv = document.createElement('div')
  resultDiv.innerHTML = "Hakee prosentteja..."
  table.parentElement.appendChild(resultDiv)

  const rows = await Array.from(table.querySelectorAll('thead th a'))
    .map(element => element.href)
    .map(async (href) => {
      return await fetch(href, { credentials: 'include'})
        .then(r => r.text())
        .then(t => (new DOMParser).parseFromString(t, 'text/html'))
        .then(d => parseDayPage(d.body))
    })
    .reduce(async (acc, p) => (await acc).concat(await p), Promise.resolve([]))

  const { total, billing, training } = rows.reduce((grouped, row) => {
    if (checkIfIgnore(row)) return grouped

    const group = getGroup(row)
    const time = grouped[group] + row.time

    const total = grouped.total + row.time
    return {
      ...grouped,
      [group]: time,
      total
    }
  }, {
    total: 0,
    billing: 0,
    training: 0
  })

  resultDiv.innerHTML = `
    <table class="recordlist">
      <tbody>
        <tr class="row1">
          <td>Laskutus</td>
          <td align="center">${billing}</td>
          <td align="center">${toPercentage(billing / total)}%</td>
        </tr>
        <tr class="row2">
          <td>Training</td>
          <td align="center">${training}</td>
          <td align="center">${toPercentage(training / total)}%</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="row1">
          <th>Yhteensä</th>
          <th>${total}</th>
          <th></th>
        </tr>
      </tfoot>
    </table>
  `
}

const parseDayPage = (body) => {
  return Array.from(body.querySelectorAll('table.recordlist tr:not(:first-child):not(:last-child'))
    .map(row => {
      const [,, project, phase, activity,, time] = Array.from(row.querySelectorAll('td')).map(c => c.innerText.trim())
      return {
        project,
        phase,
        activity,
        time: parseTime(time)
      }
    })
}

const parseTime = (text) => {
  const [hours, minutes] = text.split(':')
  return +hours + minutes / 60
}

const toPercentage = (number) => {
  return isNaN(number) ? 0 : (number*100).toFixed(2)
}

const checkIfIgnore = ({ project, phase, activity }) => {
  return project === 'Sysart' &&
    phase === 'Palkalliset poissaolot' &&
    activity !== 'Sairasloma / hoitovapaa'
}

const getGroup = ({ project, phase, activity }) => {
  if (project === 'Sysart' && phase === 'Training') {
    return 'training'
  }
  return project === 'Sysart' ? 'waste' : 'billing'
}