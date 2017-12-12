/*
    LMAOILOVEGENIUS License - version 1 - 2017-12-12

    Copyright (C) 2017 Erik Wheeler <erik(make an educated guess what symbol should be here)erikssonwheeler.se>

    By using any software using this license you MUST follow these simple rules:

    1. You MUST star the repository on Github.
    2. You are NOT allowed to sell this program is any form NOR make any revenue from it.
    3. You agree to ONLY use this software for analyzing the lyrics in any form.
    4. If you are creating a Neural Network using data gathered by this tool, you MUST generate a lyric with the only data being ALL Lil Pump's songs.
    5. If you are employeed by Genius you hereby agree to NEVER code anything in Ruby again.
    6. Also, if you are employeed by Genius you should hit me up at my email dawg.
*/

const Lyricist = require('lyricist')

const meow = require('meow')
const center = require('center-align')
const path = require('path')
const fs = require('fs-extra')

const p = require('p-fun')

Lyricist.prototype.songsByArtist = async function (id, { page = 1, perPage = 20, sort = 'title' } = {}) {
  if (!id) throw new Error('No ID was provided to lyricist.songsByArtist()')

  const path = `artists/${id}/songs?per_page=${perPage}&page=${page}&sort=${sort}`
  const data = await this._request(path)

  return data
}

const Config = require('./config')

const lyricist = new Lyricist(Config.accessToken)

const methods = ['search', 'scrape']

const cli = meow(`
        Usage:
            $ genius-scraper <method> <artist>

        Examples: (569922 is lil peep, go to artist page on genius and look at source code and you will easily find the id needed)
            $ genius-scraper list 569922
            $ genius-scraper scrape 569922
`)

if (cli.input.length < 2) throw new Error('You need a <method> (list or scrape), and a <artist> (artist id)')

const method = cli.input[0]
const artist = +cli.input[1]

if (!methods.includes(method)) throw new Error('Your <method> is invalid, only "list" & "scrape" is allowed!')

if (!(artist % 1 === 0)) throw new Error('Your <artist> is invalid, it needs to be an integer!')

async function downloadSong (songId) {
  try {
    const song = await lyricist.song(songId, { fetchLyrics: true })
    await fs.writeJSON(path.join(__dirname, 'artists', artist.toString(), `${song.id}.json`), song, { spaces: 2 })
        // console.log(`Downloaded and saved #${song.id}. ${songIds.indexOf(songId)}/${songIds.length}`)
    return { songId, success: true }
  } catch (error) {
    console.error(error)
    return { songId, success: false }
        // console.log(`Failed when downloading #${songId}, error: ${error.message}. ${songIds.indexOf(songId)}/${songIds.length}`)
  }
}

const main = async () => {
  let songs // why doesnt switch have their own scope
  let page // why doesnt switch have their own scope

  switch (method) {
    case 'search':
      songs = []
      page = 1

      while (true) {
        try {
          const data = await lyricist.songsByArtist(artist, { perPage: 50, page })

          songs.push(...data.songs)

          if (!data.next_page) break
          else page++
        } catch (error) {
          throw error
        }
      }

      console.log('-'.repeat(process.stdout.columns))

      for (const song of songs) {
        console.log(`id: #${song.id} | title: ${song.full_title}`)
      }

      console.log('-'.repeat(process.stdout.columns))
      console.log(center(`In total there is ${songs.length}x songs!`, process.stdout.columns))
      console.log('-'.repeat(process.stdout.columns))
      break
    case 'scrape':
      await fs.ensureDir(path.join(__dirname, 'artists', artist.toString()))

      songs = []
      page = 1

      while (true) {
        try {
          const data = await lyricist.songsByArtist(artist, { perPage: 50, page })

          songs.push(...data.songs)

          if (!data.next_page) break
          else page++
        } catch (error) {
          throw error
        }
      }

      const currentSongIds = (await fs.readdirSync(path.join(__dirname, 'artists', artist.toString())))
                .map(filename => filename.replace('.json', ''))
                .map(songId => +songId)

      const songIds = songs.map(song => song.id).filter(songId => !currentSongIds.includes(songId))

      console.log('-'.repeat(process.stdout.columns))
      console.log(center(`Will try to download ${songIds.length}/${songs.length} songs!`, process.stdout.columns))
      console.log('-'.repeat(process.stdout.columns))

      const allPromises = p.progress.all(songIds.map(songId => downloadSong(songId)), { concurrency: 5 })

      allPromises.onProgress(progress => console.log(center(`${(progress * 100).toFixed(2)}% done!`, process.stdout.columns)))

      const data = await allPromises

      const failed = data.filter(x => !x.success)

      console.log('-'.repeat(process.stdout.columns))

      if (failed > 0) {
        console.log(center(`${data.filter(x => !x.success).length}/${data.length} failed :/ Will dump them.`, process.stdout.columns))
        await fs.writeJSON('failed.json', failed.map(x => x.songId))
        console.log('-'.repeat(process.stdout.columns))
      }

      console.log(center(`Done downloading! Now I have ${(await fs.readdir(path.join(__dirname, 'artists', artist.toString()))).length}x of ${songs.length}x total songs for the artist :D`, process.stdout.columns))

      console.log('-'.repeat(process.stdout.columns))
      break
    default:
      console.log('huh, invalid method?')
      break
  }
}

main()
    .then(console.log)
    .catch(console.error)
