import h from './helpers.js';

window.addEventListener( 'load', () => {
    let va = [];
    let sa = [];
    let ma = [];
    let multiVideoStream = false

    const room = h.getQString( location.href, 'room' );
    const username = sessionStorage.getItem( 'username' );

    if ( !room ) {
        document.querySelector( '#room-create' ).attributes.removeNamedItem( 'hidden' );
    }

    else if ( !username ) {
        document.querySelector( '#username-set' ).attributes.removeNamedItem( 'hidden' );
    }

    else {
        let commElem = document.getElementsByClassName( 'room-comm' );

        for ( let i = 0; i < commElem.length; i++ ) {
            commElem[i].attributes.removeNamedItem( 'hidden' );
        }

        var pc = [];

        let socket = io( '/stream' );

        var socketId = '';
        var myStream = '';
        var screen = '';

        //Get user video by default
        getAndSetUserStream();


        socket.on( 'connect', () => {


            //set socketId
            socketId = socket.io.engine.id;


            socket.emit( 'subscribe', {
                room: room,
                socketId: socketId
            } );


            socket.on( 'new user', ( data ) => {
                socket.emit( 'newUserStart', { to: data.socketId, sender: socketId } );
                pc.push( data.socketId );
                init( true, data.socketId );
            } );


            socket.on( 'newUserStart', ( data ) => {
                pc.push( data.sender );
                init( false, data.sender );
            } );


            socket.on( 'ice candidates', async ( data ) => {
                data.candidate ? await pc[data.sender].addIceCandidate( new RTCIceCandidate( data.candidate ) ) : '';
            } );


            socket.on( 'sdp', async ( data ) => {
                if ( data.description.type === 'offer' ) {
                    data.description ? await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) ) : '';

                    h.getUserFullMedia().then( async ( stream ) => {
                        if ( !document.getElementById( 'local' ).srcObject ) {
                            h.setLocalStream( stream );
                        }

                        //save my stream
                        myStream = stream;

                        stream.getTracks().forEach( ( track ) => {
                            pc[data.sender].addTrack( track, stream );
                        } );

                        let answer = await pc[data.sender].createAnswer();

                        await pc[data.sender].setLocalDescription( answer );

                        socket.emit( 'sdp', { description: pc[data.sender].localDescription, to: data.sender, sender: socketId } );
                    } ).catch( ( e ) => {
                        console.error( e );
                    } );
                }

                else if ( data.description.type === 'answer' ) {
                    await pc[data.sender].setRemoteDescription( new RTCSessionDescription( data.description ) );
                }
            } );


            socket.on( 'chat', ( data ) => {
                h.addChat( data, 'remote' );
            } );
        } );

            navigator.mediaDevices.enumerateDevices().then(gotDevices).then(()=>{
                if( va.length >= 2 ){
                  if (confirm('It looks like you have 2 video sources available. Do you want to emit both?')) {
                        multiVideoStream = true
                        for(let i = 0; i < va.length; i++) {
                            navigator.mediaDevices.getUserMedia( {
                                video: {
                                    exact: { deviceId: va[i] } 
                                },
                                audio: false
                            }).then((stream)=>{
                                broadcastExtraTracks(stream, 'video')
                            })
                        }
                    } else {
                        multiVideoStream = false
                        console.log('didnt stream videos')
                    }
                    console.log(va.length)
                }
            }).catch((e)=>{
                console.log(e)
            });


        function gotDevices(deviceInfos) {
          for (let i = 0; i !== deviceInfos.length; ++i) {
            const deviceInfo = deviceInfos[i];
            const option = document.createElement('option');
            option.value = deviceInfo.deviceId;
            if (deviceInfo.kind === 'audioinput') {
              option.text = deviceInfo.label || `microphone ${ma.length + 1}`;
              ma.push(option.text);
            } else if (deviceInfo.kind === 'audiooutput') {
              option.text = deviceInfo.label || `speaker ${sa.length + 1}`;
              sa.push(option.text)
            } else if (deviceInfo.kind === 'videoinput') {
              option.text = deviceInfo.label || `camera ${va.length + 1}`;
              va.push(option.text)
            } else {
              console.log('Some other kind of source/device: ', deviceInfo);
            }
          }
        }

        document.querySelector('select#videoSource').onchange = changeVideo
        function changeVideo() {
            let videoSource = document.querySelector('select#videoSource').value;
            navigator.mediaDevices
            .getUserMedia({
              video: {
                deviceId:{
                    exact: videoSource
                },
              }
            })
            .then(function( media ) {
                broadcastNewTracks( media, 'video' )
                h.setLocalStream( media )
            }).catch( ( err ) => {
                console.log( err )
                alert( err ) //for user to see    
            })
        }

        function getAndSetUserStream() {
            h.getUserFullMedia().then( ( stream ) => {
                //save my stream
                myStream = stream;

                h.setLocalStream( stream );
            } ).catch( ( e ) => {
                console.error( `stream error: ${ e }` );
            } );
        }


        function init( createOffer, partnerName ) {
            pc[partnerName] = new RTCPeerConnection( h.getIceServer() );

            if ( screen && screen.getTracks().length ) {
                screen.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, screen );//should trigger negotiationneeded event
                } );
            }

            else if ( myStream ) {
                myStream.getTracks().forEach( ( track ) => {
                    pc[partnerName].addTrack( track, myStream );//should trigger negotiationneeded event
                } );
            }

            else {
                h.getUserFullMedia().then( ( stream ) => {
                    //save my stream
                    myStream = stream;

                    stream.getTracks().forEach( ( track ) => {
                        pc[partnerName].addTrack( track, stream );//should trigger negotiationneeded event
                    } );

                    h.setLocalStream( stream );
                } ).catch( ( e ) => {
                    console.error( `stream error: ${ e }` );
                } );
            }



            //create offer
            if ( createOffer ) {
                pc[partnerName].onnegotiationneeded = async () => {
                    let offer = await pc[partnerName].createOffer();

                    await pc[partnerName].setLocalDescription( offer );

                    socket.emit( 'sdp', { description: pc[partnerName].localDescription, to: partnerName, sender: socketId } );
                };
            }



            //send ice candidate to partnerNames
            pc[partnerName].onicecandidate = ( { candidate } ) => {
                socket.emit( 'ice candidates', { candidate: candidate, to: partnerName, sender: socketId } );
            };



            //add
            pc[partnerName].ontrack = ( e ) => {
                let str = e.streams;

                for(let i = 0; i < str.length; i++){
                    if ( document.getElementById( `${ partnerName }-video` ) ) {
                        
                    } 

                    else {
                        //video elem
                        let newVid = document.createElement( 'video' );
                        newVid.id = `${ partnerName }-video`;
                        newVid.srcObject = str[i];
                        newVid.autoplay = true;
                        newVid.className = 'remote-video';

                        //video controls elements
                        let controlDiv = document.createElement( 'div' );
                        controlDiv.className = 'remote-video-controls';
                        controlDiv.innerHTML = `<i class="fa fa-microphone text-white pr-3 mute-remote-mic" title="Mute"></i>
                            <i class="fa fa-expand text-white expand-remote-video" title="Expand"></i>`;

                        //create a new div for card
                        let cardDiv = document.createElement( 'div' );
                        cardDiv.className = 'card card-sm';
                        cardDiv.id = partnerName;
                        cardDiv.appendChild( newVid );
                        cardDiv.appendChild( controlDiv );

                        //put div in main-section elem
                        document.getElementById( 'videos' ).appendChild( cardDiv );

                        h.adjustVideoElemSize();
                    }
                }
            };



            pc[partnerName].onconnectionstatechange = ( d ) => {
                switch ( pc[partnerName].iceConnectionState ) {
                    case 'disconnected':
                        h.closeVideo( partnerName );
                        console.log('('+partnerName+') disconnected')
                        break;

                    case 'failed':
                        h.closeVideo( partnerName );
                        console.log('('+partnerName+') failed')
                        break;

                    case 'closed':
                        h.closeVideo( partnerName );
                        console.log('parter ('+partnerName+') closed')
                        break;
                }
            };



            pc[partnerName].onsignalingstatechange = ( d ) => {
                switch ( pc[partnerName].signalingState ) {
                    case 'closed':
                        console.log( "Signalling state is 'closed'" );
                        h.closeVideo( partnerName );
                        break;
                }
            };
        }



        function broadcastNewTracks( stream, type, mirrorMode = true ) {
            h.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] == 'object' ) {
                    h.replaceTrack( track, pc[pName] );
                }
            }
        }

        function broadcastExtraTracks( stream, type, mirrorMode = true ) {
            h.setLocalStream( stream, mirrorMode );

            let track = type == 'audio' ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];

            for ( let p in pc ) {
                let pName = pc[p];

                if ( typeof pc[pName] == 'object' ) {
                    console.log( pc[pName])

                    h.addTrack( track, pc[pName] );
                }
            }
        }


    }
} );
