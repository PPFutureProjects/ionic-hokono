import { Injectable } from '@angular/core';
import 'rxjs/add/operator/map';

import { AngularFireDatabase, FirebaseObjectObservable } from 'angularfire2/database';
import * as firebase from 'firebase';
import { UserProvider } from '../user/user';

declare var window: any;

@Injectable()
export class FirebaseProvider {

  profileUrl: string = 'accounts';
  getMyPetsUrl: string = 'pets';
  getMyChatsUrl: string = 'chats';

  myStarsUrl: string = 'myStars';
  myFollowingUrl: string = 'following';
  myPostLikes:string = 'myPostLikes';

  petStarredByUrl: string = 'starredBy';
  petFollowersUrl:string = 'followers';

  globalPetUrl: string = 'pets';
  globalPostsUrl: string ='posts';

  constructor(
    private db: AngularFireDatabase,
    private auth: UserProvider,
  ) {
    // console.log('Hello FirebaseProvider Provider');
  }

  getProfile(): FirebaseObjectObservable<any> {
    return this.db.object(`${this.profileUrl}/${this.auth.user.uid}`);
  }

  getPets(limit: number = 1) {
    return this.db.list(`${this.profileUrl}/${this.auth.user.uid}/${this.getMyPetsUrl}`, {
      query: {
        limitToFirst: limit
      }
    });
  }

  /** TODO: needs optimization */
  getMyChats() {
    return this.db.list(`${this.profileUrl}/${this.auth.user.uid}/${this.getMyChatsUrl}`);
  }

  getAllPets(limit: number = 10) {
    return this.db.list(this.globalPetUrl, {
      query: {
        limitToLast: limit,
      }
    });
  }

  getAllPosts(limit: number = 10) {
    return this.db.list(this.globalPostsUrl, {
      query: {
        limitToLast: limit,
        orderByChild: 'likes'
      }
    });
  }

  getMyFollowingPosts() {
    return new Promise((resolve, reject) => {
      this.db.list(`${this.profileUrl}/${this.auth.user.uid}/${this.myFollowingUrl}`)
        .subscribe(subs => {
          let newList = [];
          subs.forEach((pet, i) => {
            this.db.list(this.globalPostsUrl, {
                query: {
                  orderByChild: 'petId',
                  equalTo: pet.$key,
                  limitToLast: 10
                }
              })
              .subscribe(posts => {
                newList.push(...posts);
                if (i === subs.length - 1) {
                  resolve(newList);
                };
              });
          });
          !subs.length && resolve(newList);
        });
    });
  }



  togglePetFollow(key, profile, like = true) {
    let bundle = {};

    if (like) {
      bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.myFollowingUrl}/${key}`] = { name: profile.name };
      bundle[`/${this.profileUrl}/${profile.ownerUid}/${this.getMyPetsUrl}/${key}/${this.petFollowersUrl}/${this.auth.user.uid}`] = { displayName: this.auth.user.displayName };
      bundle[`/${this.globalPetUrl}/${key}/${this.petFollowersUrl}/${this.auth.user.uid}`] = { displayName: this.auth.user.displayName };
    } else {
      bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.myFollowingUrl}/${key}`] = {};
      bundle[`/${this.profileUrl}/${profile.ownerUid}/${this.getMyPetsUrl}/${key}/${this.petFollowersUrl}/${this.auth.user.uid}`] = {};
      bundle[`/${this.globalPetUrl}/${key}/${this.petFollowersUrl}/${this.auth.user.uid}`] = {};
    }

    return this.db.database.ref().update(bundle);
  }

  togglePetLike(key, profile, like = true) {
    let bundle = {};

    if (like) {
      bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.myStarsUrl}/${key}`] = { name: profile.name };
      bundle[`/${this.profileUrl}/${profile.ownerUid}/${this.getMyPetsUrl}/${key}/${this.petStarredByUrl}/${this.auth.user.uid}`] = { displayName: this.auth.user.displayName, createdAt: Date.now() };
      bundle[`/${this.globalPetUrl}/${key}/${this.petStarredByUrl}/${this.auth.user.uid}`] = { displayName: this.auth.user.displayName, createdAt: Date.now() };
    } else {
      bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.myStarsUrl}/${key}`] = {};
      bundle[`/${this.profileUrl}/${profile.ownerUid}/${this.getMyPetsUrl}/${key}/${this.petStarredByUrl}/${this.auth.user.uid}`] = {};
      bundle[`/${this.globalPetUrl}/${key}/${this.petStarredByUrl}/${this.auth.user.uid}`] = {};
    }

    return this.db.database.ref().update(bundle);
  }

  togglePostLike(postId, petId, ownerId, like = true) {

    this.db.database.ref(`${this.globalPostsUrl}/${postId}`)
    .transaction((post) => {
      if (post) {
        if (post.likes) {
          like ? post.likes++ : post.likes--;
        }
        if (post.likedBy) {
          like ? post.likedBy[this.auth.user.uid] = { timeStamp: Date.now() }
               : post.likedBy[this.auth.user.uid] = {};
        }
      }
      return post;
    });

    this.db.database.ref(`${this.globalPetUrl}/${petId}/posts/${postId}`)
    .transaction((post) => {
      if (post) {
        if (post.likes) {
          like ? post.likes++ : post.likes--;
        }
        if (post.likedBy) {
          like ? post.likedBy[this.auth.user.uid] = { timeStamp: Date.now() }
               : post.likedBy[this.auth.user.uid] = {};
        }
      }
      return post;
    });

    this.db.database.ref(`${this.profileUrl}/${ownerId}/${this.getMyPetsUrl}/${petId}/posts/${postId}`)
    .transaction((post) => {
      if (post) {
        if (post.likes) {
          like ? post.likes++ : post.likes--;
        }
        if (post.likedBy) {
          like ? post.likedBy[this.auth.user.uid] = { timeStamp: Date.now() }
               : post.likedBy[this.auth.user.uid] = {};
        }
      }
      return post;
    });

    this.db.database.ref(`${this.profileUrl}/${this.auth.user.uid}`)
    .transaction((post) => {
      if (post) {
        if (post.myPostLikes) {
          like ? post.myPostLikes[postId] = { petId: petId }
               : post.myPostLikes[postId] = {};
        } else if (like) {
          post.myPostLikes = { [postId]: { petId: petId } }
        }
      }
      return post;
    });
  }

  updatePetProfile(key, profile, picChanged = false): Promise<any> {
    if (!picChanged) {
      this.db.list(this.globalPetUrl).update(key, profile);
      return <Promise<any>>this.db.list(`${this.profileUrl}/${profile.ownerUid}/${this.getMyPetsUrl}`).update(key, profile);
    }

    return new Promise((resolve, reject) => {
      let imageRef = firebase.storage().ref(`${this.auth.user.uid}/${profile.id}/${profile.name}`);
      /** put image in firebase storage */
      this.makeFileIntoBlob(profile.filePath).then((blob) => {
        imageRef.put(blob).then((ss) => {
          profile.filePath = ss.downloadURL;

          let bundle =  {};
          bundle[`/${this.globalPetUrl}/${profile.id}`] = profile;
          bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.getMyPetsUrl}/${key}`] = profile;

          this.db.database.ref().update(bundle)
          .then(resolve);
        });
      });
    });
  }

  updateProfile(profile, picChanged = false): Promise<any> {
    if (!picChanged) {
      return <Promise<any>>this.db.object(`${this.profileUrl}/${this.auth.user.uid}`).update(profile);
    }

    return new Promise((resolve, reject) => {
      let imageRef = firebase.storage().ref(`${this.auth.user.uid}/profile`);
      /** put image in firebase storage */
      this.makeFileIntoBlob(profile.profPic).then((blob) => {
        imageRef.put(blob).then((ss) => {
          profile.profPic = ss.downloadURL;

          let bundle =  {};
          bundle[`/${this.profileUrl}/${this.auth.user.uid}`] = profile;

          this.db.database.ref().update(bundle)
          .then(resolve);
        });
      });
    });
  }

  postNewPet(newPet) {
    newPet = {
      ...newPet,
      id: this.db.database.ref(`${this.profileUrl}/${this.auth.user.uid}/${this.getMyPetsUrl}`).push().key,
      timeStamp: Date.now(),
      stars: 0,
      ownerUid: this.auth.user.uid,
      species: 'dog'
    };

    return new Promise((resolve, reject) => {
      let imageRef = firebase.storage().ref(`${this.auth.user.uid}/${newPet.id}/${newPet.name}`);
      /** put image in firebase storage */
      this.makeFileIntoBlob(newPet.filePath).then((blob) => {
        if (blob === null) {
          newPet.filePath = '';

          let bundle =  {};
          bundle[`/${this.globalPetUrl}/${newPet.id}`] = newPet;
          bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.getMyPetsUrl}/${newPet.id}`] = newPet;

          this.db.database.ref().update(bundle)
          .then(resolve);
        } else {
          imageRef.put(blob).then((ss) => {
            newPet.filePath = ss.downloadURL;

            let bundle =  {};
            bundle[`/${this.globalPetUrl}/${newPet.id}`] = newPet;
            bundle[`/${this.profileUrl}/${this.auth.user.uid}/${this.getMyPetsUrl}/${newPet.id}`] = newPet;

            this.db.database.ref().update(bundle)
            .then(resolve);
          });
        }
      });
    });
  }

  makeFileIntoBlob(path) {
    return new Promise((resolve, reject) => {
      if (typeof window.resolveLocalFileSystemURL !== 'function') resolve(null);

      window.resolveLocalFileSystemURL(path, (fileEntry) => {

        fileEntry.file((resFile) => {

          var reader = new FileReader();
          reader.onloadend = (evt: any) => {
            var imgBlob: any = new Blob([evt.target.result], { type: 'image/jpeg' });
            imgBlob.name = 'sample.jpg';
            resolve(imgBlob);
          };

          reader.onerror = (e) => {
            console.log('Failed file read: ' + e.toString());
            reject(e);
          };

          reader.readAsArrayBuffer(resFile);
        });
      });
    });
  }
}
