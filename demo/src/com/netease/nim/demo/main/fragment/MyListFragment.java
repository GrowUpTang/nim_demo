package com.netease.nim.demo.main.fragment;


import android.os.Bundle;
import android.support.v4.app.Fragment;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;

import com.netease.nim.demo.R;
import com.netease.nim.demo.main.model.MainTab;
import com.netease.nim.demo.main.viewholder.FuncViewHolder;
import com.netease.nim.uikit.business.contact.MyFragment;
import com.netease.nim.uikit.common.activity.UI;

/**
 * 我的
 */
public class MyListFragment extends MainTabFragment {

    private MyFragment fragment;

    public MyListFragment() {
        // Required empty public constructor
        setContainerId(MainTab.CHAT_ME.fragmentId);
    }


    @Override
    protected void onInit() {
        fragment = new MyFragment();
        fragment.setContainerId(R.id.me_fragment);

        UI activity = (UI) getActivity();

        // 如果是activity从堆栈恢复，FM中已经存在恢复而来的fragment，此时会使用恢复来的，而new出来这个会被丢弃掉
        fragment = (MyFragment) activity.addFragment(fragment);
    }

    /*@Override
    public View onCreateView(LayoutInflater inflater, ViewGroup container,
                             Bundle savedInstanceState) {
        // Inflate the layout for this fragment
        return inflater.inflate(R.layout.fragment_mylist, container, false);
    }*/

    @Override
    public void onDestroy() {
        super.onDestroy();
        FuncViewHolder.unRegisterUnreadNumChangedCallback();
    }
}
